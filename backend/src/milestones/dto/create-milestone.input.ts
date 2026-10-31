import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';

/**
 * US 5.1: datos de entrada para planificar un hito.
 *
 * No incluye `status`: todo hito nace `Pending` (el estado solo cambia al
 * completarse con evidencia, US 5.2). La fecha de creacion la fija la BD.
 */
@InputType()
export class CreateMilestoneInput {
  @Field(() => Int)
  projectId!: number;

  @Field()
  name!: string;

  @Field({ description: 'user.id del responsable (debe ser del equipo).' })
  assigneeId!: string;

  @Field(() => GraphQLISODateTime)
  dueDate!: Date;
}
