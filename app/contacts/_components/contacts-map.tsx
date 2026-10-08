"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MapUnavailable } from "@/components/map/map-unavailable";
import { useMapLibre } from "@/components/map/use-maplibre";
import { STATUS_DOT, STATUS_HEX } from "@/lib/contact-status-style";
import {
  CONTACT_STATUS_LABEL,
  CONTACT_STATUSES,
  type Contact,
} from "@/lib/contacts";
import { formatPrice } from "@/lib/format";
import { createDotMarker } from "@/lib/map-markers";
import { PRAGUE_CENTER } from "@/lib/map-styles";
import { cn } from "@/lib/utils";

/** Every contacted house on one map, coloured by status, for planning a day of visits. */
export function ContactsMap({
  contacts,
  onSelect,
}: {
  contacts: Contact[];
  onSelect: (contactId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapRef, isUnavailable } = useMapLibre(containerRef, {
    center: PRAGUE_CENTER,
    zoom: 8,
  });
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // Re-fit only when the set of houses changes, so a status change or a tab
  // switch doesn't throw away the zoom.
  const idsKey = contacts.map((contact) => contact.id).join("|");
  const fittedKey = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const contact of contacts) {
      if (contact.lat == null || contact.lng == null) continue;
      const title = contact.title ?? contact.url;
      const marker = new maplibregl.Marker({
        element: createDotMarker({
          color: STATUS_HEX[contact.status],
          size: 18,
          title: `${title} · ${CONTACT_STATUS_LABEL[contact.status]}`,
          onClick: () => onSelectRef.current(contact.id),
        }),
      })
        .setLngLat([contact.lng, contact.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12, closeButton: false }).setText(
            `${formatPrice(contact.price)} · ${title}`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([contact.lng, contact.lat]);
    }
    if (!bounds.isEmpty() && fittedKey.current !== idsKey) {
      fittedKey.current = idsKey;
      map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 });
    }
  }, [contacts, idsKey, mapRef]);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="h-[28rem] w-full">
        {isUnavailable ? (
          <MapUnavailable />
        ) : (
          <div ref={containerRef} className="size-full" />
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
        {CONTACT_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", STATUS_DOT[status])} />
            {CONTACT_STATUS_LABEL[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
