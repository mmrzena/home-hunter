import { RiTrainLine } from "@remixicon/react";
import type { HouseAnalysis } from "@/lib/analysis-types";
import { formatDistance, formatDuration, formatTransfers } from "@/lib/format";
import { HUBS } from "@/lib/hubs";
import { LocationMap } from "./location-map";

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

type Stations = HouseAnalysis["location"]["stations"];

function fastestOf(stations: Stations): Stations[number] | null {
  let best: Stations[number] | null = null;
  for (const station of stations)
    if (
      station.train &&
      (!best?.train || station.train.minutes < best.train.minutes)
    )
      best = station;
  return best;
}

export function TrainConnections({
  house,
  stations,
  hub,
}: {
  house: { lat: number; lng: number };
  stations: Stations;
  hub: HouseAnalysis["location"]["hub"];
}) {
  const town = HUBS[hub?.key ?? "prague"];
  const destination = town.station.name;
  const fastest = fastestOf(stations);
  const atHubStation = stations.find((station) => station.name === destination);
  const summary = fastest?.train
    ? `Fastest weekday-morning train to ${destination}: ${formatDuration(fastest.train.minutes)} from ${fastest.name}, ${formatDistance(fastest.km)} from the house.`
    : atHubStation
      ? `The house is in ${town.label} itself: ${destination} station is ${formatDistance(atHubStation.km)} away.`
      : `No train connection to ${destination} was found from the nearest stations.`;
  return (
    <section className="overflow-hidden rounded-2xl border">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold">Getting to {town.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {town.label} centre, straight line
          </p>
          <p className="mt-1 font-mono text-lg">{formatDistance(hub?.km)}</p>
        </div>
      </div>
      <div className="grid border-t lg:grid-cols-[1.4fr_1fr]">
        <div className="h-80 border-b lg:h-auto lg:min-h-80 lg:border-r lg:border-b-0">
          <LocationMap
            house={house}
            stations={stations.map(({ name, lat, lng }, index) => ({
              name,
              lat,
              lng,
              isFastest: stations[index] === fastest,
            }))}
          />
        </div>
        <ol className="divide-y">
          {stations.map((station) => {
            const isFastest = station === fastest;
            return (
              <li
                key={station.name}
                className="flex items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    <RiTrainLine
                      className={`size-4 shrink-0 ${isFastest ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span>{station.name}</span>
                    {isFastest && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        fastest
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistance(station.km)} from the house
                  </p>
                </div>
                {station.train ? (
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-lg">
                      {formatDuration(station.train.minutes)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatTransfers(station.train.transfers)}
                      {station.train.lines.length > 0 &&
                        ` · ${station.train.lines.join(" → ")}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      dep. {TIME.format(new Date(station.train.departsAt))}
                    </p>
                  </div>
                ) : (
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {station.name === destination
                      ? "Destination station"
                      : "No train found"}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="border-t px-6 py-4 text-xs leading-relaxed text-muted-foreground sm:px-8">
        Train times are the fastest rail-only journey leaving between about
        06:00 and 09:00 on the next weekday, from timetables via Transitous.
        Getting to the station and waiting aren't included. Station distances
        are straight lines from the advertised location.
      </p>
    </section>
  );
}
