export interface ViewportEvent {
	type: 'scroll' | 'resize';
	timestamp: number;
}

export interface ScrollEvent extends ViewportEvent {
	type: 'scroll';
	scrollTop: number;
	scrollLeft: number;
	scrollHeight: number;
	scrollWidth: number;
	elementId: string;
}

export interface ResizeEvent extends ViewportEvent {
	type: 'resize';
	width: number;
	height: number;
	innerWidth: number;
	innerHeight: number;
}
