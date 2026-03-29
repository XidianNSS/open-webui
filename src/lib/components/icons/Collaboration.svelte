<script lang="ts">
	export let className = 'w-4 h-4';
	export let strokeWidth = '1.8';
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	viewBox="0 0 24 24"
	stroke-width={strokeWidth}
	stroke="currentColor"
	aria-hidden="true"
	class={className}
>
	<circle cx="6.5" cy="12" r="2.25" />
	<circle cx="17.5" cy="7" r="2.25" />
	<circle cx="17.5" cy="17" r="2.25" />
	<path stroke-linecap="round" stroke-linejoin="round" d="M8.75 12h4.25M15.65 8.45l-2.8 2.05M15.65 15.55l-2.8-2.05" />
</svg>
