import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hermes 豆包后台',
  description: 'AI Agent 管理后台 — 管理定时任务、查询信息',
  manifest: '/hermes/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hermes',
  },
  icons: {
    apple: '/hermes/icons/apple-icon-180.png',
  },
};

export default function HermesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
