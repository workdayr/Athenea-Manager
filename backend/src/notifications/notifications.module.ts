import { Module } from '@nestjs/common';
import { EmailOutboxScheduler } from './email-outbox.scheduler.js';
import { EmailService } from './email.service.js';
import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';

/**
 * RF-014: notificaciones in-app y correo asincrono.
 *
 * `NotificationsService` y los helpers `notifyUser`/`notifyRole` se
 * exportan para que otros modulos encolen notificaciones dentro de sus
 * propias transacciones.
 */
@Module({
  providers: [
    NotificationsService,
    EmailService,
    EmailOutboxScheduler,
    NotificationsResolver,
  ],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
