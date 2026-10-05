"""Plain-language situation brief. Uses Gemini's free tier if a key is set, otherwise a template."""

import httpx

from .. import config

HAZARD_WORDS = {"flood": "flooding", "heat": "extreme heat", "landslide": "landslides", "wind": "high winds"}
TYPE_PLURAL = {
    "hospital": "hospitals", "substation": "substations", "power_plant": "power plants",
    "bridge": "bridges", "road": "roads", "water": "water facilities", "fire_station": "fire stations",
}


def _facts(city_name: str, horizon: int, scenario_name: str | None, overview: dict, plan: dict | None) -> dict:
    at_risk = [a for a in overview["assets"] if a["level"] in ("high", "critical")]
    by_type: dict[str, int] = {}
    for a in at_risk:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1
    split = overview["hazard_split"]
    main_hazard = max(split, key=split.get) if any(split.values()) else None
    return {
        "city": city_name,
        "when": "the next 24 hours" if horizon == 0 else f"the 24 hours starting {horizon} hours from now",
        "scenario": scenario_name,
        "score": overview["score"],
        "level": overview["level"],
        "weather": overview["weather"],
        "at_risk_total": len(at_risk),
        "at_risk_by_type": by_type,
        "main_hazard": main_hazard,
        "top": sorted(at_risk, key=lambda a: -a["score"])[:5],
        "actions": (plan or {}).get("selected", [])[:5],
        "total_assets": len(overview["assets"]),
    }


def _template_admin(f: dict) -> str:
    w = f["weather"]
    lines = [
        f"SITUATION BRIEF: {f['city'].upper()}",
        f"Period: {f['when']}" + (f" (stress test: {f['scenario']})" if f["scenario"] else " (live forecast)"),
        "",
        f"Overall risk is {f['level'].upper()} at {f['score']} out of 1000.",
        f"Forecast: {w['rain24']:.0f} mm of rain, feels-like temperature up to {w['apparent_max']:.0f} °C, "
        f"gusts up to {w['gust']:.0f} km/h, river discharge at {w['river_ratio']:.1f}x its 90-day normal.",
        "",
    ]
    if not f["at_risk_total"]:
        lines.append(
            f"None of the {f['total_assets']} monitored assets is at high risk in this period. "
            "No preventive action is needed beyond routine monitoring."
        )
        return "\n".join(lines)

    parts = [f"{n} {TYPE_PLURAL[t]}" for t, n in sorted(f["at_risk_by_type"].items(), key=lambda x: -x[1])]
    lines.append(
        f"{f['at_risk_total']} of {f['total_assets']} monitored assets are at high or critical risk "
        f"({', '.join(parts)}). The main driver is {HAZARD_WORDS.get(f['main_hazard'], 'mixed hazards')}."
    )
    lines += ["", "MOST EXPOSED ASSETS"]
    for a in f["top"]:
        why = a["factors"][0]["why"] if a["factors"] else ""
        lines.append(f"  - {a['name']} ({a['type'].replace('_', ' ')}): {a['score']:.0f}/100. {why}")
    if f["actions"]:
        lines += ["", "RECOMMENDED ACTIONS, IN PRIORITY ORDER"]
        for i, c in enumerate(f["actions"], start=1):
            lines.append(f"  {i}. {c['asset']}: {c['action']} (about {c['cost']} lakh INR, {c['crews']} crew).")
    lines += ["", "Dependency links and costs are estimates. Verify on the ground before committing resources."]
    return "\n".join(lines)


def _template_public(f: dict) -> str:
    level = {"low": "LOW", "moderate": "MODERATE"}.get(f["level"], "HIGH")
    lines = [f"PUBLIC ADVISORY: {f['city'].upper()}", f"Risk level for {f['when']}: {level}", ""]
    hazard = f["main_hazard"]
    if f["level"] == "low" or not hazard:
        lines.append("No significant weather risk to essential services is expected. Carry on as normal.")
        return "\n".join(lines)
    advice = {
        "flood": [
            "Avoid low-lying roads and underpasses; do not drive through standing water.",
            "Keep phones charged and store drinking water in case supply is interrupted.",
            "Move valuables and vehicles to higher ground if you live near a river or drain.",
        ],
        "heat": [
            "Stay indoors between 12 pm and 4 pm and drink water often.",
            "Check on elderly neighbours and young children.",
            "Expect possible power cuts during peak hours; keep a fan or cool room ready.",
        ],
        "landslide": [
            "Avoid hillside roads during and after heavy rain.",
            "Watch for cracks, tilting trees or muddy water on slopes and report them.",
        ],
        "wind": [
            "Stay away from trees, hoardings and power lines.",
            "Secure loose items on balconies and rooftops.",
        ],
    }[hazard]
    lines.append(f"The main concern is {HAZARD_WORDS[hazard]}.")
    lines += [f"  - {tip}" for tip in advice]
    lines += ["", "Use the Safe Route tab to find the nearest hospital that is not at risk."]
    return "\n".join(lines)


def _gemini(prompt: str) -> str | None:
    if not config.GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent"
    try:
        res = httpx.post(
            url,
            headers={"x-goog-api-key": config.GEMINI_API_KEY},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=40,
        )
        res.raise_for_status()
        return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None


def make_brief(
    city_name: str, horizon: int, scenario_name: str | None, overview: dict, plan: dict | None, public: bool
) -> dict:
    facts = _facts(city_name, horizon, scenario_name, overview, plan)
    template = _template_public(facts) if public else _template_admin(facts)
    audience = (
        "the general public, in simple reassuring language with clear do's and don'ts"
        if public
        else "city disaster-management officials, concise and action-oriented"
    )
    prompt = (
        f"Rewrite this infrastructure risk summary as a short brief for {audience}. "
        "Use only the facts given; do not invent numbers, names or places. Plain text, no markdown.\n\n"
        + template
    )
    ai_text = _gemini(prompt)
    return {"text": ai_text or template, "source": "gemini" if ai_text else "template"}
