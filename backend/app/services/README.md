# LangChain integration point

Keep model calls out of route handlers and controllers. Add a `taste_bridge_service.py`
here with a stable function such as `explain_dish(dish, home_cuisine, profile)` and
inject it into the dish controller when connecting LangChain. Use the curated dish
catalog as grounded context, require structured JSON output matching the API fields,
and keep dietary flags sourced from ingredients rather than generated text. The current
catalog provides deterministic demo responses, so the frontend can be developed now.
