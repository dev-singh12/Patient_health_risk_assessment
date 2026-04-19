import { env } from "../../config/env";
import type { IKnowledgeService } from "./knowledge.interface";
import { MockKnowledgeService } from "./mock.knowledge.service";
import { ExternalKnowledgeService } from "./external.knowledge.service";

export type { IKnowledgeService } from "./knowledge.interface";
export { MockKnowledgeService } from "./mock.knowledge.service";
export { ExternalKnowledgeService } from "./external.knowledge.service";

/**
 * Factory function that returns the correct IKnowledgeService implementation
 * based on the KNOWLEDGE_SERVICE_IMPL environment variable.
 *
 * - `"mock"`     → MockKnowledgeService (development / test)
 * - `"external"` → ExternalKnowledgeService (production)
 */
function createKnowledgeService(): IKnowledgeService {
  if (env.KNOWLEDGE_SERVICE_IMPL === "external") {
    return new ExternalKnowledgeService();
  }

  return new MockKnowledgeService();
}

/**
 * Singleton instance of the active IKnowledgeService implementation.
 * Import this throughout the application rather than constructing new instances.
 */
export const knowledgeService: IKnowledgeService = createKnowledgeService();
