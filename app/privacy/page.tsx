export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="prose prose-lg">
        <h1 className="text-4xl font-serif font-bold mb-6">Privacy Policy</h1>

        <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Introduction</h2>
        <p className="text-gray-700 mb-4">
          Elsebrew (&quot;I,&quot; &quot;my,&quot; or &quot;the service&quot;) is committed to protecting your privacy. This Privacy
          Policy explains how I collect, use, and share information when you use this website.
        </p>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Information I collect</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Information you provide</h3>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li>Email address (if you sign up for the newsletter)</li>
          <li>Google account information (name, email, profile picture) if you choose to sign in with Google</li>
          <li>Search queries (café names and cities you search for)</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">Automatically collected information</h3>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li>Usage data via Google Analytics (page views, clicks, search events)</li>
          <li>Device and browser information</li>
          <li>IP address (anonymized)</li>
        </ul>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">How I use your information</h2>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li>To provide and improve the café matching service</li>
          <li>To send you updates about new features (if you opted in)</li>
          <li>To analyze usage patterns and validate product-market fit</li>
          <li>To personalize your experience (saved cafés stored locally in your browser)</li>
        </ul>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Third-party services</h2>
        <p className="text-gray-700 mb-4">This service uses the following third-party providers:</p>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li><strong>Google Maps Platform:</strong> For location data, café search, and mapping</li>
          <li><strong>Google Identity Services:</strong> For optional sign-in functionality</li>
          <li><strong>Google Analytics:</strong> For usage analytics (if configured)</li>
          <li><strong>OpenAI:</strong> For generating café match explanations</li>
          <li><strong>Mailchimp:</strong> For newsletter subscriptions (if configured)</li>
        </ul>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Data storage and retention</h2>
        <p className="text-gray-700 mb-4">
          Most of your data is stored locally in your browser (saved cafés, sign-in state). I do
          not store Google Places content (café names, photos, reviews) on servers beyond
          temporary caching (5 minutes) for performance. Search queries may be logged for analytics
          purposes.
        </p>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Your rights</h2>
        <ul className="list-disc pl-6 text-gray-700 mb-4">
          <li>You can clear your saved cafés and sign-out state by clearing your browser data</li>
          <li>You can unsubscribe from the newsletter at any time</li>
          <li>You can request deletion of your data by contacting me</li>
        </ul>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Cookies</h2>
        <p className="text-gray-700 mb-4">
          This service uses minimal cookies for analytics purposes. You can disable cookies in your browser
          settings, though this may affect functionality.
        </p>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Changes to this policy</h2>
        <p className="text-gray-700 mb-4">
          I may update this Privacy Policy from time to time. I&apos;ll notify you of significant
          changes by posting a notice on the website.
        </p>

        <h2 className="text-2xl font-serif font-semibold mt-8 mb-4">Contact</h2>
        <p className="text-gray-700 mb-4">
          If you have questions about this Privacy Policy, please contact me at{' '}
          <a href="mailto:brdners@gmail.com" className="text-espresso hover:underline">
            brdners@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
