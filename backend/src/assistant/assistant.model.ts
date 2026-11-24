import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

/**
 * Contrato GraphQL del Asistente Virtual RAG (F2-08).
 * Los nombres coinciden con `frontend/src/lib/assistant.ts`.
 */
@ObjectType()
export class AssistantCitationGql {
  @Field(() => ID)
  id!: string;

  /** Proyecto del documento; `null` para documentos institucionales. */
  @Field(() => Int, { nullable: true })
  projectId!: number | null;

  /** UUID de `Document` o id de `ProjectDocument`. */
  @Field(() => ID)
  documentId!: string;

  @Field()
  documentTitle!: string;

  @Field()
  documentType!: string;

  @Field(() => String, { nullable: true })
  section!: string | null;

  @Field(() => Int, { nullable: true })
  page!: number | null;

  @Field()
  excerpt!: string;
}

@ObjectType()
export class AssistantAnswerGql {
  @Field(() => ID)
  id!: string;

  @Field()
  content!: string;

  /** `false` cuando el asistente se niega a responder sin fundamento. */
  @Field()
  grounded!: boolean;

  @Field(() => String, { nullable: true })
  refusalReason!: string | null;

  @Field(() => [AssistantCitationGql])
  citations!: AssistantCitationGql[];

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@InputType()
export class AssistantHistoryMessageInput {
  @Field()
  role!: string;

  @Field()
  content!: string;
}

@InputType()
export class AssistantQueryInput {
  @Field()
  question!: string;

  @Field(() => String, { nullable: true })
  conversationId?: string;

  @Field(() => [AssistantHistoryMessageInput], { nullable: true })
  history?: AssistantHistoryMessageInput[];

  @Field(() => Int, { nullable: true })
  topK?: number;
}
