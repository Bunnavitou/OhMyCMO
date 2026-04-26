export default function MoreTCs() {
  return (
    <div className="space-y-4">
      <article className="card prose prose-sm max-w-none space-y-3">
        <header>
          <h2 className="text-base md:text-lg font-bold">Terms &amp; Conditions</h2>
          <p className="text-[11px] md:text-xs text-steel">Last updated: April 2026</p>
        </header>

        <Section title="1. Acceptance of terms">
          By using OhMyCMO you agree to these terms. If you do not agree, please stop
          using the app.
        </Section>

        <Section title="2. Local data storage">
          OhMyCMO currently stores all your work inside this device's browser
          storage. We do not transmit your customer, partner or financial data to a
          remote server. Clearing site data, switching browsers or signing out via
          the More menu will remove this data permanently.
        </Section>

        <Section title="3. Acceptable use">
          You agree not to use the app to store unlawful content, infringe third-party
          rights, or process data you are not authorised to handle.
        </Section>

        <Section title="4. Liability">
          The app is provided "as is" without warranty. We are not liable for any data
          loss, business decisions or damages resulting from use of the app.
        </Section>

        <Section title="5. Changes">
          We may update these terms at any time. Continued use after changes
          constitutes acceptance of the new terms.
        </Section>

        <Section title="6. Contact">
          For any questions, reach out to the project owner at
          <span className="font-semibold"> laybunnavitou@kosign.com.kh</span>.
        </Section>
      </article>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-sm md:text-base font-semibold text-white">{title}</h3>
      <p className="text-xs md:text-sm text-white/75 leading-relaxed mt-1">
        {children}
      </p>
    </section>
  )
}
