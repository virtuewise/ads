export const metadata = {
  title: 'PrintSync Creative Studio',
  description: 'PrintSync Creative Operating System — Brand-aware advertising engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
