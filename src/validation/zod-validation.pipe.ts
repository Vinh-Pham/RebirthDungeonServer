import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Validate and transform request data without relying on DTO class metadata. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<
  unknown,
  Promise<z.output<T>>
> {
  constructor(private readonly schema: T) {}

  async transform(value: unknown): Promise<z.output<T>> {
    const result = await this.schema.safeParseAsync(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: result.error.issues.map(({ path, code, message }) => ({
          path,
          code,
          message,
        })),
      });
    }
    return result.data;
  }
}
