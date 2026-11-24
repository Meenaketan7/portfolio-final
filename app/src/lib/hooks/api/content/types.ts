// Types of the published content contract, derived from its Schema definitions in contract.ts.
// `export type` is erased at build time, so browser code that imports these types never loads Schema.
export type {
	ContentBlock,
	ContentKind,
	DiscoveryEntry,
	PublishedRecord,
	PublishedSummary
} from './contract.js';
