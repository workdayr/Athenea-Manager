import {
  Field,
  GraphQLISODateTime,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

/** US 4.1 / RF-005: nivel de acceso de un documento. */
export enum DocumentVisibilityGql {
  TEAM_ONLY = 'Team_only',
  SHARED_WITH_ADMINISTRATION = 'Shared_with_administration',
}

registerEnumType(DocumentVisibilityGql, {
  name: 'DocumentVisibility',
  description:
    'Team_only = solo el equipo del proyecto; Shared_with_administration = tambien administracion.',
});

/** Espejo del enum DocType de Prisma (US 4.1). */
export enum DocTypeGql {
  HYPOTHESIS = 'hypothesis',
  ABSTRACT = 'abstract',
  METHODOLOGY = 'methodology',
  RATIONALE = 'rationale',
  RESULTS = 'results',
  ETHICS_APPROVAL = 'ethics_approval',
  EVIDENCE = 'evidence',
}

registerEnumType(DocTypeGql, {
  name: 'DocType',
  description: 'Tipo documental del expediente del proyecto.',
});

/** F1-11 / BR-003: estado de revision administrativa del documento. */
export enum DocumentReviewStatusGql {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

registerEnumType(DocumentReviewStatusGql, {
  name: 'DocumentReviewStatus',
  description:
    'Pending = aun no revisado; Approved = aprobado por la administracion; Rejected = rechazado.',
});

@ObjectType()
export class ProjectDocumentGql {
  @Field(() => Int)
  documentId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field(() => DocTypeGql)
  docType!: DocTypeGql;

  @Field(() => DocumentVisibilityGql)
  visibility!: DocumentVisibilityGql;

  @Field(() => String, { nullable: true })
  fileName!: string | null;

  @Field(() => Int, { nullable: true })
  fileSize!: number | null;

  @Field(() => Int)
  version!: number;

  @Field(() => GraphQLISODateTime)
  uploadedAt!: Date;

  /** Derivado del tipo documental: protocolo o aprobacion de etica. */
  @Field()
  mandatoryReview!: boolean;

  /** El usuario actual puede cambiarla (PI + proyecto no terminal + no obligatorio). */
  @Field()
  canChangeVisibility!: boolean;

  /** F1-11 / BR-003: estado de revision administrativa. */
  @Field(() => DocumentReviewStatusGql)
  reviewStatus!: DocumentReviewStatusGql;

  @Field(() => GraphQLISODateTime, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  reviewerName!: string | null;

  @Field(() => String, { nullable: true })
  reviewNotes!: string | null;

  /** El usuario actual puede aprobar/rechazar este documento. */
  @Field()
  canReview!: boolean;
}
