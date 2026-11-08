# Content proposal: full-stack-to-ai-analyst

New role `ai-analyst` (AI analyst), `coming_soon`: analysis plus LLM-assisted analytics work. Source role `full-stack-engineer` unchanged (covers python-basics, git, rest-apis, docker, sql). No existing ids changed. Reused existing topics: probability-statistics, numpy, pandas, matplotlib, llm-basics, prompt-engineering, structured-output, llm-evals. 9 new topics, 2 new areas. All resources `proposed`.

## Areas (2)
- data-analysis: cleaning, EDA, statistics, BI, communication.
- llm-for-analysis: LLMs applied to analysis workflows.

## New topics and edges, `topic <- learn_first`
- data-cleaning <- pandas: tidy the table before anything else.
- exploratory-data-analysis <- data-cleaning, matplotlib, probability-statistics: profile clean data with plots and summary stats.
- statistical-inference <- probability-statistics, pandas: tests and intervals build on the probability basics.
- data-visualisation-bi <- exploratory-data-analysis, sql: dashboards sit on SQL and on knowing what to show.
- data-storytelling <- data-visualisation-bi: narrative and chart choice follow chart skills.
- text-to-sql <- sql, prompt-engineering, structured-output: schema-aware prompts yielding validated queries.
- document-extraction <- structured-output, llm-evals: typed extraction must be measured.
- ai-assisted-analysis <- exploratory-data-analysis, prompt-engineering: know the manual workflow to verify the model's.
- ai-assisted-reporting <- data-storytelling, ai-assisted-analysis, llm-evals: grounded drafts, evaluated.

Role requires 17 topics (8 reused, 9 new); `llm-basics` is covered transitively and listed explicitly. sql is covered by the source role. No cycles (all new edges point to earlier topics). New hours total 60 (rough, human to adjust).

## Resources: 33 across 9 topics
Every URL was fetched and its title confirmed. Counts: data-cleaning 4, EDA 3, statistical-inference 4, data-visualisation-bi 5, data-storytelling 4, text-to-sql 3, document-extraction 4, ai-assisted-analysis 4, ai-assisted-reporting 2.

## Notes for review
- Below the 3-resource target: ai-assisted-reporting (2). Few authoritative non-vendor sources exist; suggest a human add one.
- text-to-sql has only 3, two of them benchmarks (Spider, BIRD) rather than tutorials; a Braintrust cookbook page was found but its redirected URL was not confirmed within budget.
- Dropped: LangChain `sql_qa` tutorial (308-redirects to an unrelated RAG page); replaced by the `sql-agent` page.
- Datawrapper Academy and Microsoft Learn Power BI root were redirected or 404; final URLs are the confirmed ones.
- Reused URLs: Python Data Science Handbook (data-cleaning, EDA) and Wilke (viz, storytelling) appear under two topics each, with separate ids.
- Coursera "Introduction to Generative AI for Data Analysis" is marked `is_free: false` (free audit not confirmed).
- Kaggle, Khan Academy, Think Stats and Metabase pages were confirmed by title only (little page text returned).
- The Power BI resources are vendor-specific; a tool-neutral BI alternative may be wanted.
- `content:validate` will likely flag new topics with no approved resource only if a live role requires them; this role is `coming_soon`.
