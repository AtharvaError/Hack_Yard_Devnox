"""Knock-on failure simulation over the inferred dependency graph."""

import networkx as nx

from ..models import Asset, City, Dependency

SERVING_TYPES = ("hospital", "substation", "water")


def served_population(city: City, assets: list[Asset]) -> dict[int, int]:
    """Rough estimate: the city's population split evenly across assets of the same type."""
    counts: dict[str, int] = {}
    for a in assets:
        counts[a.type] = counts.get(a.type, 0) + 1
    return {
        a.id: (city.population // counts[a.type] if a.type in SERVING_TYPES and city.population else 0)
        for a in assets
    }


def build_graph(assets: list[Asset], deps: list[Dependency]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for a in assets:
        graph.add_node(a.id, type=a.type, name=a.name)
    for d in deps:
        graph.add_edge(d.source_id, d.target_id, kind=d.kind)
    return graph


def simulate(city: City, assets: list[Asset], deps: list[Dependency], failed_ids: list[int]) -> dict:
    graph = build_graph(assets, deps)
    by_id = {a.id: a for a in assets}
    down = {i for i in failed_ids if i in by_id}  # assets that stop working and pass the failure on
    status: dict[int, dict] = {
        i: {"status": "failed", "reason": "Failed directly", "wave": 0} for i in down
    }

    wave = 0
    changed = True
    while changed and wave < 10:
        changed = False
        wave += 1
        newly_down: set[int] = set()
        for node in graph.nodes:
            if node in down:
                continue
            inbound = list(graph.in_edges(node, data="kind"))
            lost_power = [s for s, _, k in inbound if k == "power" and s in down]
            lost_water = [s for s, _, k in inbound if k == "water" and s in down]
            access = [s for s, _, k in inbound if k == "access"]
            lost_access = [s for s in access if s in down]
            kind = by_id[node].type

            result = None
            if lost_power and kind == "water":
                # Pumps stop without grid power, so the outage carries on downstream.
                result = ("failed", f"No power from {by_id[lost_power[0]].name}")
                newly_down.add(node)
            elif access and len(lost_access) == len(access):
                result = ("isolated", "All mapped access routes are cut")
            elif lost_power:
                label = "on backup power" if kind in ("hospital", "fire_station") else "degraded"
                result = (label, f"Grid supply lost from {by_id[lost_power[0]].name}")
            elif lost_water:
                result = ("degraded", f"Water supply lost from {by_id[lost_water[0]].name}")
            elif lost_access:
                result = ("access reduced", f"{by_id[lost_access[0]].name} is cut")

            if result and status.get(node, {}).get("status") != result[0]:
                status[node] = {"status": result[0], "reason": result[1], "wave": wave}
                changed = True
        down |= newly_down

    served = served_population(city, assets)
    impacted = [
        {
            "id": i,
            "name": by_id[i].name,
            "type": by_id[i].type,
            "lat": by_id[i].lat,
            "lon": by_id[i].lon,
            "people": served[i],
            **info,
        }
        for i, info in status.items()
    ]
    impacted.sort(key=lambda x: (x["wave"], x["name"]))
    hospitals_hit = [x for x in impacted if x["type"] == "hospital"]
    return {
        "impacted": impacted,
        "waves": max((x["wave"] for x in impacted), default=0),
        "links": [
            {"from": [by_id[s].lon, by_id[s].lat], "to": [by_id[t].lon, by_id[t].lat], "kind": k}
            for s, t, k in graph.edges(data="kind")
            if s in status and t in status
        ],
        "summary": {
            "total": len(impacted),
            "knock_on": len([x for x in impacted if x["wave"] > 0]),
            "hospitals": len(hospitals_hit),
            # Hospital catchments only, to avoid counting the same people twice.
            "people": sum(x["people"] for x in hospitals_hit),
        },
    }


def downstream_count(graph: nx.DiGraph, asset_id: int) -> int:
    return len(nx.descendants(graph, asset_id)) if asset_id in graph else 0
