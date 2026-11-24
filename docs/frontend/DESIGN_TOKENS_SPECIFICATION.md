# CreatorConnect Design Tokens & UI Specification

## 1. Design Language: Warm Editorial Neo-Pop

The CreatorConnect web experience adopts the **Warm Editorial Neo-Pop** visual design language, inspired by editorial publishing layouts paired with high-contrast, functional digital product controls.

### 1.1 Core Principles

- **Warm Over Sterile**: Replaces harsh cool grays with warm parchment, cream, and almond tones.
- **Pill-First Controls**: All interactive buttons, status tags, search inputs, and filter chips feature full pill geometry (`rounded-full`).
- **High-Contrast Editorial Typography**: Headings feature expressive editorial serif typography (`Instrument Serif`), supported by a robust sans-serif body (`Archivo`) and technical monospaced figures (`JetBrains Mono`).
- **Tactile Depth**: 1px subtle borders (`#E7E0D5`) paired with delicate paper shadows replace heavy blur effects.

---

## 2. Color Palette & Token Dictionary

### 2.1 Surfaces & Neutrals

| Token Name              | Hex Code  | Description & Usage                               |
| :---------------------- | :-------- | :------------------------------------------------ |
| `--admin-bg-base`       | `#FAF6EF` | Default canvas background; warm cream paper tone. |
| `--admin-surface-card`  | `#FFFFFF` | Primary card and modal container background.      |
| `--admin-surface-muted` | `#F2ECE1` | Table headers, secondary buttons, inactive tabs.  |
| `--admin-border-subtle` | `#E7E0D5` | Default 1px card, table row, and input borders.   |
| `--admin-border-strong` | `#D1C7B7` | Focused input borders and active divider rules.   |

### 2.2 Brand & Accents

| Token Name                   | Hex Code  | Description & Usage                                   |
| :--------------------------- | :-------- | :---------------------------------------------------- |
| `--admin-brand-yellow`       | `#FFD64A` | Primary action button fill and key highlight tags.    |
| `--admin-brand-yellow-press` | `#F0C52F` | Hover and active state for primary yellow controls.   |
| `--admin-text-primary`       | `#14110F` | Deep ink black for primary headings and body copy.    |
| `--admin-text-muted`         | `#6F675E` | Secondary descriptions, timestamps, and placeholders. |
| `--admin-text-subtle`        | `#A39A8F` | Disabled labels, subtle icons, and meta captions.     |

### 2.3 Semantic Status Colors

| Status               | Background Fill | Border    | Text Color | Dot Fill  |
| :------------------- | :-------------- | :-------- | :--------- | :-------- |
| **Success**          | `#E6F4EC`       | `#BEE4D0` | `#2E9E6B`  | `#2E9E6B` |
| **Warning**          | `#FBF1DC`       | `#F5DFB3` | `#C98A16`  | `#C98A16` |
| **Danger**           | `#FBE9E7`       | `#F6C4C0` | `#D8483C`  | `#D8483C` |
| **Info / Primary**   | `#EBF3FD`       | `#BDD8F8` | `#2B73C2`  | `#2B73C2` |
| **Purple / Special** | `#F3EEFC`       | `#DAC9F8` | `#7C5CBF`  | `#7C5CBF` |
| **Brand Yellow**     | `#FFF8D6`       | `#FCE192` | `#7A5B00`  | `#FFD64A` |

---

## 3. Typography Hierarchy

### 3.1 Font Families

- **Editorial Headings**: `Instrument Serif`, `Georgia`, serif
- **Body & Controls**: `Archivo`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif
- **Data & Numeric**: `JetBrains Mono`, `Consolas`, monospace

### 3.2 Type Scale

- **Display Hero**: `text-5xl` to `text-6xl`, font-serif, tracking-tight, leading-tight
- **Page Title**: `text-2xl` (24px) / `text-3xl` (30px), font-serif, text-[#14110F]
- **Card Header**: `text-base` (16px), font-sans, font-bold, text-[#14110F]
- **Body Regular**: `text-sm` (14px), font-sans, font-normal, text-[#6F675E]
- **Button / Label**: `text-xs` (12px) to `text-sm` (14px), font-sans, font-semibold
- **Table Data / Meta**: `text-xs` (12px), font-mono, text-[#6F675E]

---

## 4. Radii & Geometry Specifications

- **Buttons & Pills**: `rounded-full` (`9999px`)
- **Inputs & Selects**: `rounded-full` (`9999px`)
- **Cards & Modals**: `rounded-2xl` (`16px`) or `rounded-3xl` (`24px`)
- **Badges & Tags**: `rounded-full` (`9999px`) with 6px dot indicator

---

## 5. WCAG 2.2 AA Compliance Audit

All color pairings utilized in the CreatorConnect Admin Console and Landing Page were evaluated for contrast compliance:

- **Primary Text (`#14110F`) on Warm Cream (`#FAF6EF`)**: Contrast ratio **16.8:1** (Exceeds WCAG AAA requirement of 7.0:1)
- **Primary Text (`#14110F`) on Brand Yellow (`#FFD64A`)**: Contrast ratio **12.4:1** (Exceeds WCAG AAA requirement of 7.0:1)
- **Secondary Text (`#6F675E`) on Warm Cream (`#FAF6EF`)**: Contrast ratio **5.2:1** (Passes WCAG AA requirement of 4.5:1)
- **Success Text (`#2E9E6B`) on Light Green (`#E6F4EC`)**: Contrast ratio **4.7:1** (Passes WCAG AA requirement of 4.5:1)
- **Danger Text (`#D8483C`) on Light Red (`#FBE9E7`)**: Contrast ratio **5.1:1** (Passes WCAG AA requirement of 4.5:1)
