import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Branding */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Made with ❤️ by Ido</span>
            <span>•</span>
            <span className="text-xs">Powered by Google</span>
          </div>

          {/* Links */}
          <nav className="flex items-center space-x-6 text-sm">
            <Link
              href="/about"
              className="text-gray-600 hover:text-espresso transition-colors"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-espresso transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 hover:text-espresso transition-colors"
            >
              Terms
            </Link>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Elsebrew. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
