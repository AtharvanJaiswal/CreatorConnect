import { execSync } from 'node:child_process';

export class DockerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

export class PostgresContainerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostgresContainerNotFoundError';
  }
}

export interface PostgresContainerInfo {
  id: string;
  name: string;
  image: string;
  ports: string;
  source: 'explicit' | 'env' | 'compose' | 'discovery';
}

export interface PostgresContainerResolverOptions {
  preferredName?: string | undefined;
  strictName?: boolean | undefined;
  sourceDb?: string | undefined;
  dbUser?: string | undefined;
  commandExecutor?: ((cmd: string) => string) | undefined;
}

interface ContainerCandidate {
  id: string;
  name: string;
  image: string;
  ports: string;
  labels: string;
  score: number;
}

export class PostgresContainerResolver {
  private static defaultExecutor(cmd: string): string {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }

  /**
   * Checks whether the Docker CLI and daemon are accessible.
   */
  public static isDockerAvailable(executor?: (cmd: string) => string): boolean {
    const exec = executor ?? this.defaultExecutor;
    try {
      exec('docker version --format "{{.Server.Version}}"');
      return true;
    } catch {
      try {
        exec('docker --version');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Resolves the active PostgreSQL container in the current environment using
   * a layered discovery strategy:
   * 1. Environment variables (POSTGRES_CONTAINER_NAME, PG_CONTAINER)
   * 2. Explicit / preferred container name if provided and running
   * 3. Docker Compose service resolution (`docker compose ps -q postgres`)
   * 4. Running container inspection via `docker ps` matching image / compose label / port
   */
  public static resolve(options: PostgresContainerResolverOptions = {}): PostgresContainerInfo {
    const exec = options.commandExecutor ?? this.defaultExecutor;

    if (!this.isDockerAvailable(exec)) {
      throw new DockerUnavailableError(
        'Docker CLI or daemon is unavailable. The database restore drill requires Docker to execute pg_dump and pg_restore in an isolated container.',
      );
    }

    // 1. Check environment variables
    const envContainer = process.env.POSTGRES_CONTAINER_NAME || process.env.PG_CONTAINER;
    if (envContainer && this.isContainerRunning(envContainer, exec)) {
      return {
        id: envContainer,
        name: envContainer,
        image: this.getContainerImage(envContainer, exec),
        ports: '',
        source: 'env',
      };
    }

    // 2. Check explicit preferred name
    if (options.preferredName) {
      if (this.isContainerRunning(options.preferredName, exec)) {
        return {
          id: options.preferredName,
          name: options.preferredName,
          image: this.getContainerImage(options.preferredName, exec),
          ports: '',
          source: 'explicit',
        };
      }

      if (options.strictName) {
        throw new PostgresContainerNotFoundError(
          `Configured PostgreSQL container "${options.preferredName}" is not running or does not exist.`,
        );
      }
    }

    // 3. Check Docker Compose service resolution
    const composeContainer = this.resolveFromCompose(exec);
    if (composeContainer) {
      return composeContainer;
    }

    // 4. Discover running container via `docker ps`
    const discovered = this.discoverFromDockerPs(exec);
    if (discovered) {
      return discovered;
    }

    const checkedDetails = [
      options.preferredName ? `preferred name "${options.preferredName}"` : null,
      envContainer ? `env variable "${envContainer}"` : null,
      'Docker Compose service "postgres"',
      'running containers with image matching "postgres"',
    ]
      .filter(Boolean)
      .join(', ');

    throw new PostgresContainerNotFoundError(
      `No running PostgreSQL container found. Checked: ${checkedDetails}. Ensure PostgreSQL is running via Docker Compose ('docker compose up -d postgres') or as a GitHub Actions service container.`,
    );
  }

  private static isContainerRunning(
    containerIdOrName: string,
    exec: (cmd: string) => string,
  ): boolean {
    try {
      const output = exec(`docker inspect --format "{{.State.Running}}" ${containerIdOrName}`);
      return output.trim() === 'true';
    } catch {
      return false;
    }
  }

  private static getContainerImage(
    containerIdOrName: string,
    exec: (cmd: string) => string,
  ): string {
    try {
      return exec(`docker inspect --format "{{.Config.Image}}" ${containerIdOrName}`).trim();
    } catch {
      return '';
    }
  }

  private static resolveFromCompose(exec: (cmd: string) => string): PostgresContainerInfo | null {
    try {
      const output = exec('docker compose ps -q postgres');
      const containerId = output.split(/\r?\n/)[0]?.trim();
      if (containerId && this.isContainerRunning(containerId, exec)) {
        return {
          id: containerId,
          name: 'compose-postgres',
          image: this.getContainerImage(containerId, exec),
          ports: '',
          source: 'compose',
        };
      }
    } catch {
      // Fall through to docker ps discovery
    }
    return null;
  }

  private static discoverFromDockerPs(exec: (cmd: string) => string): PostgresContainerInfo | null {
    try {
      const output = exec(
        'docker ps --filter "status=running" --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Labels}}"',
      );
      const lines = output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const candidates: ContainerCandidate[] = [];

      for (const line of lines) {
        const parts = line.split('\t');
        const id = parts[0]?.trim() ?? '';
        const name = parts[1]?.trim() ?? '';
        const image = parts[2]?.trim() ?? '';
        const ports = parts[3]?.trim() ?? '';
        const labels = parts[4]?.trim() ?? '';

        if (!id) continue;

        let score = 0;

        // Image contains postgres (e.g. postgres:16-alpine, postgres:16, postgres)
        if (/postgres/i.test(image)) {
          score += 20;
        }

        // Docker Compose postgres service label
        if (/com\.docker\.compose\.service=postgres/i.test(labels)) {
          score += 30;
        }

        // Name contains postgres (e.g. creatorconnect-postgres, runner-...-postgres)
        if (/postgres/i.test(name)) {
          score += 10;
        }

        // Exposes standard PostgreSQL port 5432
        if (/5432/i.test(ports)) {
          score += 5;
        }

        if (score > 0) {
          candidates.push({ id, name, image, ports, labels, score });
        }
      }

      if (candidates.length === 0) {
        return null;
      }

      // Sort descending by score
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0]!;

      return {
        id: best.id,
        name: best.name,
        image: best.image,
        ports: best.ports,
        source: 'discovery',
      };
    } catch {
      return null;
    }
  }
}
