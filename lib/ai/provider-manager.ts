import { ownerModel, ownerModelName } from './owner-provider';

export function getProviderForModel(modelId: string) {
  return { client: () => ownerModel(modelId), actualModel: ownerModelName(modelId) };
}

export default getProviderForModel;
