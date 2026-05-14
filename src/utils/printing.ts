interface PrintableLabel {
  title: string;
  subtitle: string;
  details: string[];
  qrImageSrc: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openPrintWindow(title: string, html: string, css: string) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>${css}</style>
      </head>
      <body>
        ${html}
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export function printZebraLabels(labels: PrintableLabel[]) {
  const html = `
    <section class="label-sheet">
      ${labels
        .map(
          (label) => `
            <article class="zebra-label">
              <div class="label-copy">
                <p class="label-kicker">${escapeHtml(label.subtitle)}</p>
                <h1>${escapeHtml(label.title)}</h1>
                <ul>${label.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
              </div>
              <img src="${label.qrImageSrc}" alt="${escapeHtml(label.title)}" />
            </article>
          `,
        )
        .join('')}
    </section>
  `;

  openPrintWindow(
    'Sticker Labels',
    html,
    `
      @page { margin: 0.2in; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        color: #142a3d;
        background: #fff;
      }
      .label-sheet {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(4in, 4in));
        gap: 0.12in;
        justify-content: center;
        padding: 0.12in;
      }
      .zebra-label {
        width: 4in;
        min-height: 2in;
        display: grid;
        grid-template-columns: 1fr 1.25in;
        align-items: center;
        gap: 0.12in;
        padding: 0.12in;
        border: 1px solid #111;
        box-sizing: border-box;
        page-break-inside: avoid;
      }
      .zebra-label h1 {
        margin: 0.06in 0;
        font-size: 18px;
        line-height: 1.05;
      }
      .label-kicker {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .zebra-label ul {
        margin: 0;
        padding-left: 16px;
        font-size: 11px;
      }
      .zebra-label img {
        width: 1.15in;
        height: 1.15in;
        justify-self: center;
      }
    `,
  );
}

export function printLocationLabels(labels: PrintableLabel[]) {
  const html = `
    <section class="location-sheet">
      ${labels
        .map(
          (label) => `
            <article class="location-label">
              <h1>${escapeHtml(label.title)}</h1>
              <p>${escapeHtml(label.subtitle)}</p>
              <img src="${label.qrImageSrc}" alt="${escapeHtml(label.title)}" />
              <div class="location-lines">${label.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join('')}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `;

  openPrintWindow(
    'Location Labels',
    html,
    `
      @page { margin: 0.25in; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        color: #111827;
      }
      .location-sheet {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(4.5in, 4.5in));
        gap: 0.2in;
        justify-content: center;
        padding: 0.2in;
      }
      .location-label {
        min-height: 3in;
        border: 2px solid #111827;
        padding: 0.22in;
        display: grid;
        justify-items: center;
        align-content: start;
        gap: 0.08in;
        page-break-inside: avoid;
      }
      .location-label h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1;
      }
      .location-label p {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .location-label img {
        width: 2.2in;
        height: 2.2in;
      }
      .location-lines {
        display: flex;
        gap: 0.14in;
        flex-wrap: wrap;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }
    `,
  );
}
