# Content proposal: full-stack-to-ai-engineer

New live role `ai-engineer` (AI engineer): building applications on foundation models. Source role `full-stack-engineer` unchanged (covers python-basics, git, rest-apis, docker, sql). The role requires 12 new topics; no existing ids changed. Existing ML topics are not reused (training maths is out of scope). All resources are `proposed`.

## Areas (5)
- llm-fundamentals: model mental model, prompting, typed output.
- rag-and-retrieval: embeddings, vector search, RAG.
- agents-and-tools: tool calling and agent loops.
- llm-evaluation: evals and guardrails.
- llmops: cost, latency, observability, deployment.

## Topics (12) and edges, `topic <- learn_first`
- llm-basics <- python-basics, rest-apis: the API mental model needs the language and HTTP.
- prompt-engineering <- llm-basics: prompts make sense once tokens and context are clear.
- structured-output <- prompt-engineering: schemas are prompts with enforcement.
- embeddings-vector-search <- llm-basics, sql: vectors need model basics; pgvector reuses SQL.
- rag <- embeddings-vector-search, prompt-engineering: retrieve, then prompt with the results.
- tool-use <- structured-output, rest-apis: tool calls are schema-valid output that hits your APIs.
- agents <- tool-use: an agent is a loop over tool calls.
- llm-evals <- prompt-engineering, git: need prompts to test; version eval sets.
- llm-guardrails <- structured-output, llm-evals: validate output, then test the defences.
- llm-cost-latency <- llm-basics, prompt-engineering: tokens drive cost; prompts drive tokens.
- llm-observability <- llm-evals, rest-apis: traces feed evals; sits on service calls.
- llm-app-deployment <- docker, rest-apis, llm-cost-latency: ship the service, with streaming and cost in mind.

Hours total 87 (rough, human to adjust).

## Resources: 41 across 12 topics
URLs were fetched and titles confirmed. OpenAI links use developers.openai.com (platform.openai.com redirects there).

## Notes for review
- Short topics: structured-output has 2 resources and llm-observability has 2 (below the 3-5 target); more could not be confirmed within the fetch budget. A search for further Anthropic/OpenTelemetry pages is suggested.
- Dropped: DeepLearning.AI "Building Systems with the ChatGPT API" (HTTP 500 on fetch); OpenTelemetry GenAI semantic conventions page (moved, target not confirmed).
- RAG/DLAI course is marked `is_free: false` (module 1 previews free, certificate paid).
- `pnpm content:validate` currently errors for all 12 new topics: "in a live role but has no approved resource". Expected until a human approves resources; the role may need to be `status: draft` until then if validation must stay green.
- Karpathy videos were confirmed by YouTube page title only.
