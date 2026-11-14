import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

/** F2-02 / RF-011: rol dentro del equipo del proyecto. */
export enum ProjectRoleGql {
  Principal_Investigator = 'Principal_Investigator',
  Co_Investigator = 'Co_Investigator',
  Assistant = 'Assistant',
}

registerEnumType(ProjectRoleGql, { name: 'ProjectRole' });

/** F2-02 / BR-010: estado de una invitacion de equipo. */
export enum InvitationStatusGql {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Revoked = 'Revoked',
  Expired = 'Expired',
}

registerEnumType(InvitationStatusGql, { name: 'InvitationStatus' });

@ObjectType()
export class TeamMemberGql {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => ProjectRoleGql)
  projectRole!: ProjectRoleGql;
}

@ObjectType()
export class TeamInvitationGql {
  @Field(() => ID)
  invitationId!: number;

  @Field()
  email!: string;

  @Field(() => ProjectRoleGql)
  projectRole!: ProjectRoleGql;

  @Field(() => InvitationStatusGql)
  status!: InvitationStatusGql;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  acceptedAt!: Date | null;
}

@InputType()
export class InviteTeamMemberInput {
  @Field()
  email!: string;

  @Field(() => ProjectRoleGql)
  projectRole!: ProjectRoleGql;

  /** BR-010: el PI declara que no existe conflicto familiar con el invitado. */
  @Field(() => Boolean)
  affidavitSigned!: boolean;
}

@ObjectType()
export class InvitationAcceptanceGql {
  @Field(() => Int)
  projectId!: number;

  @Field()
  projectTitle!: string;
}
