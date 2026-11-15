export function ErrorsMini() {
  return (
    <div className="px-mini px-errors" aria-hidden="true">
      <div className="px-mini-row">
        <code>TypeError</code>
        <span className="px-mini-sub">1,284 events</span>
      </div>
      <p>Cannot read properties of undefined (reading &apos;total&apos;)</p>
      <pre>
        <code>at renderSummary (cart.tsx:88)</code>
        <code className="is-hot">at Checkout (checkout.tsx:41)</code>
        <code>at App (app.tsx:12)</code>
      </pre>
      <div className="px-error-tags">
        <span>release 4.12.0</span>
        <span>Chrome 131</span>
        <span>regressed</span>
      </div>
    </div>
  );
}
