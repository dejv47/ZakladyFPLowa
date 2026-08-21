import "./globals.css";

export const metadata = {
  title: "Zakłady",
  description: "Prywatna liga zakładów znajomych"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
