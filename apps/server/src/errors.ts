// SPDX-License-Identifier: Apache-2.0

// Errors that tell the client what was wrong with its request, each with its HTTP status. The error
// handler sends their messages, which are written for users and hold no internal details.

export class RequestError extends Error {
  readonly statusCode: number;
  // The field of the request the refusal is about, where it is about one, such as a name another
  // record has, so the page can name the refusal under that field.
  readonly field: string | undefined;

  constructor(statusCode: number, message: string, field?: string) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
  }
}

export class BadRequestError extends RequestError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ForbiddenError extends RequestError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends RequestError {
  constructor(message = "Not Found") {
    super(404, message);
  }
}

export class ConflictError extends RequestError {
  constructor(message: string, field?: string) {
    super(409, message, field);
  }
}
