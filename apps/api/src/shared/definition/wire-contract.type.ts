import type {
	CalibrationRoundKind,
	CalibrationRoundOutcome,
	FriendshipStatus,
	PuzzleAttemptKind,
	TrainingCycleStatus,
	TrainingFinishedReason,
	TrainingStatus,
	UserRole,
} from '@chesspecker/api-definitions';

import type { FriendshipStatus as FriendshipStatusEnum } from '../../module/friendship/definition/friendship-status.enum';
import type { CalibrationRoundKind as CalibrationRoundKindEnum } from '../../module/training/definition/calibration-round-kind.enum';
import type { CalibrationRoundOutcome as CalibrationRoundOutcomeEnum } from '../../module/training/definition/calibration-round-outcome.enum';
import type { PuzzleAttemptKind as PuzzleAttemptKindEnum } from '../../module/training/definition/puzzle-attempt-kind.enum';
import type { TrainingCycleStatus as TrainingCycleStatusEnum } from '../../module/training/definition/training-cycle-status.enum';
import type { TrainingFinishedReason as TrainingFinishedReasonEnum } from '../../module/training/definition/training-finished-reason.enum';
import type { TrainingStatus as TrainingStatusEnum } from '../../module/training/definition/training-status.enum';
import type { UserRole as UserRoleEnum } from '../../module/user/definition/user-role.enum';

type Covers<A extends B, B> = A;

type _CalibrationRoundKindWire = Covers<`${CalibrationRoundKindEnum}`, CalibrationRoundKind>;
type _CalibrationRoundKindEnum = Covers<CalibrationRoundKind, `${CalibrationRoundKindEnum}`>;
type _CalibrationRoundOutcomeWire = Covers<
	`${CalibrationRoundOutcomeEnum}`,
	CalibrationRoundOutcome
>;
type _CalibrationRoundOutcomeEnum = Covers<
	CalibrationRoundOutcome,
	`${CalibrationRoundOutcomeEnum}`
>;
type _FriendshipStatusWire = Covers<`${FriendshipStatusEnum}`, FriendshipStatus>;
type _FriendshipStatusEnum = Covers<FriendshipStatus, `${FriendshipStatusEnum}`>;
type _PuzzleAttemptKindWire = Covers<`${PuzzleAttemptKindEnum}`, PuzzleAttemptKind>;
type _PuzzleAttemptKindEnum = Covers<PuzzleAttemptKind, `${PuzzleAttemptKindEnum}`>;
type _TrainingCycleStatusWire = Covers<`${TrainingCycleStatusEnum}`, TrainingCycleStatus>;
type _TrainingCycleStatusEnum = Covers<TrainingCycleStatus, `${TrainingCycleStatusEnum}`>;
type _TrainingFinishedReasonWire = Covers<`${TrainingFinishedReasonEnum}`, TrainingFinishedReason>;
type _TrainingFinishedReasonEnum = Covers<TrainingFinishedReason, `${TrainingFinishedReasonEnum}`>;
type _TrainingStatusWire = Covers<`${TrainingStatusEnum}`, TrainingStatus>;
type _TrainingStatusEnum = Covers<TrainingStatus, `${TrainingStatusEnum}`>;
type _UserRoleWire = Covers<`${UserRoleEnum}`, UserRole>;
type _UserRoleEnum = Covers<UserRole, `${UserRoleEnum}`>;
