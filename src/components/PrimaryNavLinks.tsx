"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  testid: string;
  label: string;
  href: string;
}

interface PrimaryNavLinksProps {
  items: NavItem[];
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function PrimaryNavLinks({ items }: PrimaryNavLinksProps) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.testid}
            href={item.href}
            data-testid={item.testid}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-emerald-300"
                : "text-zinc-400 hover:text-emerald-300"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
