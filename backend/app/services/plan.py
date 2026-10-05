"""Preventive action plan with a budget-constrained prioritiser."""

import networkx as nx

from .cascade import downstream_count

# Indicative cost (in lakh INR), crews needed and share of risk removed. Planning assumptions, not quotes.
ACTIONS = {
    ("flood", "hospital"): ("Deploy flood barriers and raise the backup generator and oxygen plant", 12, 2, 0.55),
    ("flood", "substation"): ("Install temporary flood walls and raise control panels", 15, 2, 0.60),
    ("flood", "power_plant"): ("Sandbag intake areas and pre-position dewatering pumps", 20, 3, 0.45),
    ("flood", "bridge"): ("Inspect piers for scour, clear debris and prepare a closure plan", 6, 1, 0.40),
    ("flood", "road"): ("Clear storm drains and pre-position pumps and diversion signage", 4, 1, 0.45),
    ("flood", "water"): ("Seal pump houses and protect electrical switchgear", 10, 2, 0.55),
    ("flood", "fire_station"): ("Move vehicles to higher ground and sandbag entrances", 3, 1, 0.50),
    ("heat", "hospital"): ("Test backup power, add cooling capacity and stock IV fluids", 8, 1, 0.50),
    ("heat", "substation"): ("Add transformer cooling and schedule load shedding to cut overload", 10, 2, 0.55),
    ("heat", "power_plant"): ("Check cooling water supply and derate units during peak hours", 14, 2, 0.40),
    ("heat", "bridge"): ("Inspect expansion joints and bearings", 3, 1, 0.35),
    ("heat", "road"): ("Monitor for surface buckling and plan night-time repairs", 2, 1, 0.30),
    ("heat", "water"): ("Raise reservoir levels and service pumps before peak demand", 6, 1, 0.45),
    ("heat", "fire_station"): ("Check water tenders and crew heat-safety supplies", 2, 1, 0.40),
    ("landslide", "road"): ("Clear hillside drains, install netting and prepare a diversion", 9, 2, 0.50),
    ("landslide", "bridge"): ("Inspect abutments and slopes, stage earth-moving equipment", 8, 2, 0.45),
    ("wind", "substation"): ("Secure loose equipment and trim trees near lines", 4, 1, 0.45),
    ("wind", "bridge"): ("Set wind-speed closure thresholds and post marshals", 2, 1, 0.40),
}
FALLBACK = {
    "flood": ("Protect the site with sandbags and stage pumps", 5, 1, 0.40),
    "heat": ("Check cooling and backup power", 4, 1, 0.35),
    "landslide": ("Inspect the slope and clear drainage", 6, 1, 0.40),
    "wind": ("Secure loose structures and trim nearby trees", 3, 1, 0.35),
}
MIN_SCORE = 20


def build_plan(
    scored: list[dict],
    graph: nx.DiGraph,
    served: dict[int, int],
    budget: float | None,
    crews: int | None,
) -> dict:
    candidates = []
    for asset in scored:
        if asset["score"] < MIN_SCORE or not asset["dominant"]:
            continue
        action, cost, crew, reduction = ACTIONS.get(
            (asset["dominant"], asset["type"]), FALLBACK[asset["dominant"]]
        )
        dependents = downstream_count(graph, asset["id"])
        # Benefit: risk removed, weighted by how critical the asset is and how many others rely on it.
        benefit = asset["score"] * reduction * asset["criticality"] * (1 + 0.5 * dependents)
        candidates.append(
            {
                "asset_id": asset["id"],
                "asset": asset["name"],
                "type": asset["type"],
                "hazard": asset["dominant"],
                "score": asset["score"],
                "level": asset["level"],
                "action": action,
                "cost": cost,
                "crews": crew,
                "risk_after": round(asset["score"] * (1 - reduction), 1),
                "dependents": dependents,
                "people": served.get(asset["id"], 0),
                "benefit": round(benefit, 1),
                "lat": asset["lat"],
                "lon": asset["lon"],
            }
        )

    # Greedy by benefit per unit cost: a standard, explainable approach to the knapsack problem.
    candidates.sort(key=lambda c: -c["benefit"] / c["cost"])
    selected, deferred = [], []
    spent, used_crews = 0.0, 0
    for c in candidates:
        over_budget = budget is not None and spent + c["cost"] > budget
        over_crews = crews is not None and used_crews + c["crews"] > crews
        if over_budget or over_crews:
            c["deferred_because"] = "budget" if over_budget else "crews"
            deferred.append(c)
            continue
        spent += c["cost"]
        used_crews += c["crews"]
        selected.append(c)

    for rank, c in enumerate(selected, start=1):
        c["rank"] = rank
    total_benefit = sum(c["benefit"] for c in candidates)
    # Catchments of different asset types overlap, so report the largest single-type total.
    people_by_type: dict[str, int] = {}
    for c in selected:
        people_by_type[c["type"]] = people_by_type.get(c["type"], 0) + c["people"]
    return {
        "selected": selected,
        "deferred": deferred,
        "totals": {
            "cost": spent,
            "crews": used_crews,
            "actions": len(selected),
            "people": max(people_by_type.values(), default=0),
            "benefit_share": round(100 * sum(c["benefit"] for c in selected) / total_benefit) if total_benefit else 0,
        },
    }
