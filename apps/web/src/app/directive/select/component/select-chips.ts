import { SelectOptionViewModel } from '@app/directive/select/select.store';

export interface SelectChipViewModel {
	value: string;
	label: string;
	head: string;
	tail: string;
}

export function toSelectChip(option: SelectOptionViewModel): SelectChipViewModel {
	const label = option.label.trim();
	const lastSpaceIndex = label.lastIndexOf(' ');

	return {
		value: option.value,
		label,
		head: -1 === lastSpaceIndex ? '' : label.slice(0, lastSpaceIndex + 1),
		tail: -1 === lastSpaceIndex ? label : label.slice(lastSpaceIndex + 1),
	};
}
