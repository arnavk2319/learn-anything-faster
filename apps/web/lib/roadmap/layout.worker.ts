// ELK's own worker script: when evaluated inside a web worker it installs `self.onmessage`
// and answers elk-api's protocol. So the whole worker is this one import.
import "elkjs/lib/elk-worker.min.js";
