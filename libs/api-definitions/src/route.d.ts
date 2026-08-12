import { AuthUser, LoginRequest, RegisterRequest } from './auth';
import {
	BlockUserRequest,
	FriendRequests,
	FriendUser,
	Friendship,
	SendFriendRequest,
	UserBlock,
} from './friendship';
import {
	ApiPuzzle,
	GetPuzzleCatalogRequest,
	ImportPuzzleRequest,
	ImportPuzzleResult,
	PuzzleCatalogPage,
	SearchPuzzleRequest,
} from './puzzle';
import {
	CalibrationAttemptResult,
	CalibrationRound,
	CalibrationRoundPuzzles,
	CalibrationRoundStart,
	CycleAttemptResult,
	GetTrainingActivityRequest,
	SelectTrainingSetRequest,
	SelectTrainingSetResult,
	SetTrainingGoalRequest,
	SubmitCalibrationAttemptRequest,
	SubmitCycleAttemptRequest,
	Training,
	TrainingActivity,
	TrainingCycle,
	TrainingCycleItem,
	TrainingGoal,
	TrainingProgress,
} from './training';
import { SearchUserRequest, UserSummary } from './user';
import { UpsertUserSettingRequest, UserSetting } from './user-setting';

export interface ApiEndpoint {
	readonly path?: Readonly<Record<string, string>>;
	readonly params?: object;
	readonly query?: object;
	readonly response: unknown;
}

/**
 * Route-map constraint. Bound to the map itself (`M extends ApiEndpointMap<M>`)
 * instead of `Record<string, ApiEndpoint>`: interfaces get no implicit index
 * signature, so they would never satisfy that.
 */
export type ApiEndpointMap<M> = Record<keyof M, ApiEndpoint>;

export type ApiVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiModule =
	'auth' | 'friendship' | 'puzzle' | 'training' | 'user' | 'userBlock' | 'userSetting';

export interface AuthGetRoutes {
	'/logout': { response: undefined };
	'/refresh-session': { response: undefined };
	'/me': { response: AuthUser };
}

export interface AuthPostRoutes {
	'/register': { params: RegisterRequest; response: AuthUser };
	'/login': { params: LoginRequest; response: undefined };
}

export interface FriendshipGetRoutes {
	'': { response: readonly FriendUser[] };
	'/request': { response: FriendRequests };
}

export interface FriendshipPostRoutes {
	'/request': { params: SendFriendRequest; response: Friendship };
}

export interface FriendshipPatchRoutes {
	'/:uuid/accept': { path: { uuid: string }; response: Friendship };
	'/:uuid/decline': { path: { uuid: string }; response: Friendship };
}

export interface FriendshipDeleteRoutes {
	'/:uuid': { path: { uuid: string }; response: undefined };
	'/user/:uuid': { path: { uuid: string }; response: undefined };
}

export interface PuzzleGetRoutes {
	'': { query: SearchPuzzleRequest; response: readonly ApiPuzzle[] };
	'/catalog': { query: GetPuzzleCatalogRequest; response: PuzzleCatalogPage };
	'/:lichessId': { path: { lichessId: string }; response: ApiPuzzle };
}

export interface PuzzlePostRoutes {
	'/import': { params: ImportPuzzleRequest; response: ImportPuzzleResult };
}

export interface TrainingGetRoutes {
	'': { response: readonly Training[] };
	'/activity': { query: GetTrainingActivityRequest; response: TrainingActivity };
	'/:uuid': { path: { uuid: string }; response: Training };
	'/:uuid/progress': { path: { uuid: string }; response: TrainingProgress };
	'/:uuid/calibration/round': { path: { uuid: string }; response: readonly CalibrationRound[] };
	'/:uuid/calibration/round/:roundUuid/puzzle': {
		path: { uuid: string; roundUuid: string };
		response: CalibrationRoundPuzzles;
	};
	'/:uuid/cycle': { path: { uuid: string }; response: readonly TrainingCycle[] };
	'/:uuid/cycle/next': { path: { uuid: string }; response: TrainingCycleItem };
}

export interface TrainingPostRoutes {
	'': { response: Training };
	'/:uuid/set': {
		path: { uuid: string };
		params: SelectTrainingSetRequest;
		response: SelectTrainingSetResult;
	};
	'/:uuid/goal': {
		path: { uuid: string };
		params: SetTrainingGoalRequest;
		response: TrainingGoal;
	};
	'/:uuid/finish': { path: { uuid: string }; response: undefined };
	'/:uuid/calibration/round': { path: { uuid: string }; response: CalibrationRoundStart };
	'/:uuid/calibration/attempt': {
		path: { uuid: string };
		params: SubmitCalibrationAttemptRequest;
		response: CalibrationAttemptResult;
	};
	'/:uuid/cycle': { path: { uuid: string }; response: TrainingCycle };
	'/:uuid/cycle/attempt': {
		path: { uuid: string };
		params: SubmitCycleAttemptRequest;
		response: CycleAttemptResult;
	};
}

export interface TrainingDeleteRoutes {
	'/:uuid': { path: { uuid: string }; response: undefined };
}

export interface UserGetRoutes {
	'': { query: SearchUserRequest; response: readonly UserSummary[] };
}

export interface UserBlockGetRoutes {
	'': { response: readonly UserBlock[] };
}

export interface UserBlockPostRoutes {
	'': { params: BlockUserRequest; response: UserBlock };
}

export interface UserBlockDeleteRoutes {
	'/:uuid': { path: { uuid: string }; response: undefined };
}

export interface UserSettingGetRoutes {
	'': { response: readonly UserSetting[] };
}

export interface UserSettingPutRoutes {
	'/:key': {
		path: { key: string };
		params: UpsertUserSettingRequest;
		response: UserSetting;
	};
}

export interface UserSettingDeleteRoutes {
	'/:key': { path: { key: string }; response: undefined };
}
