"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadCatalogue, vendorOf } from "@/lib/catalogue";
export default function ModelPaper() {
  const [vendors, setVendors] = useState<[string, number][] | null>(null);
  useEffect(() => {
    let active = true;
    loadCatalogue().then(models => {
      if (!active) return;
      const counts = new Map<string, number>();
      for (const model of models) { const vendor = vendorOf(model.id); counts.set(vendor, (counts.get(vendor) ?? 0) + 1); }
      setVendors([...counts].sort((a, b) => b[1] - a[1]));
    });
    return () => { active = false; };
  }, []);
  if (!vendors) return <p role="status" className="home-panel home-copy">Loading the model catalogue…</p>;
  if (!vendors.length) return <div className="home-panel"><p className="home-copy">The catalogue is unavailable right now. Check the models page for current availability.</p><Link className="mt-4 inline-block text-purple-300" href="/models">Open the catalogue →</Link></div>;
  return <div className="vendor-grid">{vendors.slice(0, 8).map(([name, count], i) => <Link href="/models" className="vendor-destination" key={name}><span className="vendor-orbit" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><span><strong>{name}</strong><small>{count} models in the catalogue</small></span><span aria-hidden="true">↗</span></Link>)}</div>;
}
