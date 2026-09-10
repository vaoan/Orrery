/** The application's root layout. */
export default function RootLayout({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <html lang="en"><body>{children}</body></html>;
}
