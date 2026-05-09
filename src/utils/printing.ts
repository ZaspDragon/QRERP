export function printLabel(title: string, qrImageSrc: string, payloadText: string, detailRows: string[]) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    return;
  }

  const detailsMarkup = detailRows.map((row) => `<li>${row}</li>`).join('');
  const escapedPayload = payloadText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f8fc;
            color: #15304b;
            margin: 0;
            padding: 24px;
          }
          .label {
            max-width: 440px;
            margin: 0 auto;
            background: white;
            border: 1px solid #d7e5f2;
            border-radius: 18px;
            padding: 24px;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 12px;
          }
          img {
            width: 240px;
            height: 240px;
            display: block;
            margin: 16px auto;
          }
          ul {
            padding-left: 20px;
          }
          pre {
            font-size: 12px;
            line-height: 1.45;
            white-space: pre-wrap;
            word-break: break-word;
            background: #f2f7fb;
            border-radius: 12px;
            padding: 12px;
          }
        </style>
      </head>
      <body>
        <section class="label">
          <h1>${title}</h1>
          <img src="${qrImageSrc}" alt="${title}" />
          <ul>${detailsMarkup}</ul>
          <pre>${escapedPayload}</pre>
        </section>
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
