import "./globals.css";

export const metadata = {
  title: "Video Thoughts",
  description: "Pause YouTube videos and record timestamped thoughts"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-mist">
        {children}
      </body>
    </html>
  );
}
