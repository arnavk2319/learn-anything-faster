# Content proposal: full-stack-to-ml-engineer

Roles: `full-stack-engineer` (live) and `ml-engineer` (live). The first covers the five "current role" topics; the second requires the 18 ML topics. All resources are `proposed`. Hours are rough estimates for the human to adjust.

## Areas (6)
- math-foundations: maths behind models (spec launch list).
- python-for-ml: array and data tooling every ML library builds on.
- classical-ml: pre-deep-learning supervised methods and how to judge them.
- deep-learning: neural nets through transformers.
- mlops: getting models to production and keeping them healthy.
- covered-by-current-role: what a full-stack engineer already knows; subtracted from the roadmap.

## Topics (23) and prerequisite edges (28), `topic <- learn_first`
- linear-algebra, probability-statistics, calculus-gradients: roots, no prerequisites.
- numpy <- python-basics: array code needs the language.
- pandas <- numpy: built on NumPy arrays.
- matplotlib <- numpy: plots take arrays.
- supervised-learning-basics <- numpy, pandas, probability-statistics: data handling plus basic statistics.
- regression <- supervised-learning-basics, linear-algebra, calculus-gradients: matrix form and gradient fitting.
- classification <- supervised-learning-basics, probability-statistics: probabilistic outputs.
- model-evaluation <- supervised-learning-basics: needs a trained model to judge.
- feature-engineering <- pandas, model-evaluation: transform data, then measure the effect.
- neural-networks <- regression, classification: generalises both.
- backpropagation-training <- neural-networks, calculus-gradients: chain rule on networks.
- cnns <- backpropagation-training: need training mechanics first.
- transformers <- backpropagation-training, linear-algebra: attention is matrix maths.
- experiment-tracking <- model-evaluation, git: log metrics, version code.
- model-serving <- rest-apis, docker, model-evaluation: API plus container for a vetted model.
- model-monitoring <- model-serving, probability-statistics: drift detection needs a served model and distributions.
- python-basics, git, rest-apis, docker, sql: roots; covered by `full-stack-engineer`.

## Resources: 82 across 23 topics
Each entry has a source_note giving why it fits. Official docs, established courses (Coursera, Kaggle, Khan, Google ML Crash Course, Stanford) and well-known video series (3Blue1Brown, Karpathy, CS231n) preferred. All URLs were fetched and the page title confirmed.

## Dropped
- neuralnetworksanddeeplearning.com (Nielsen book): TLS certificate mismatch on fetch; not re-tried.
- Weights & Biases quickstart: redirects to docs.coreweave.com; dropped.
- Mode SQL tutorial: redirects to thoughtspot.com; dropped.

## Notes for review
- Duplicate URLs across topics: ISLR (supervised-learning-basics, regression, classification), Coursera ML specialization (supervised-learning-basics, classification), Mathematics for Machine Learning (linear-algebra, calculus-gradients).
- Khan Academy pages return the generic title "Khan Academy"; verify-urls title matching may need a looser rule.
- The Coursera `is_free: false` flags assume paid certificates, even if audit is available.
