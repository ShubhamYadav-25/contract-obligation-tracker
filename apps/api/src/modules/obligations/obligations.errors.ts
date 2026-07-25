/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import { InvalidTransitionError } from "../../shared/errors/invalid-transition-error.js";

export class ObligationTransitionRejectedError extends InvalidTransitionError {}
