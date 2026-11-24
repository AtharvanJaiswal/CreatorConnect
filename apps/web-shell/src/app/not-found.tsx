import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF6EF] flex flex-col items-center justify-center p-4 font-sans-body">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E7E0D5] p-8 text-center shadow-sm">
        <h2 className="text-2xl font-bold text-[#14110F] mb-2 font-serif">Page Not Found</h2>
        <p className="text-sm text-[#6F675E] mb-6">
          The requested resource does not exist or requires administrative authentication.
        </p>
        <Link
          href="/admin/login"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#FFD64A] hover:bg-[#F0C52F] text-[#14110F] font-semibold text-sm transition-colors"
        >
          Return to Admin Portal
        </Link>
      </div>
    </div>
  );
}
