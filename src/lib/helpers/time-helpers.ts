const styleToTimestampLetter = {
	"short time": "t",
	"long time": "T",
	"short date": "d",
	"long date": "D",
	"short date and time": "f",
	"long date and time": "F",
	"relative": "R",
}

export function discordTimestamp(time: Temporal.PlainDateTime, style: keyof typeof styleToTimestampLetter) {
	const utcDateTime = time.toZonedDateTime("UTC");
	const epochSeconds = utcDateTime.epochMilliseconds / 1000;
	return `<t:${epochSeconds.toFixed(0)}:${styleToTimestampLetter[style]}>`;
}