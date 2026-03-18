import { addMinutes, isBefore, isAfter, setHours, setMinutes, setSeconds, isSameDay, startOfDay, addDays, getDay, differenceInMinutes } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

const START_HOUR = 8;
const END_HOUR = 18;

export function isBusinessHour(date: Date): boolean {
    const zonedDate = toZonedTime(date, TIMEZONE);
    const day = getDay(zonedDate);
    const hour = zonedDate.getHours();

    const isWeekend = day === 0 || day === 6;
    const isWorkingHour = hour >= START_HOUR && hour < END_HOUR;

    return !isWeekend && isWorkingHour;
}

function moveToNextBusinessStart(date: Date): Date {
    let zoned = toZonedTime(date, TIMEZONE);
    const hour = zoned.getHours();
    const day = getDay(zoned);

    // Se é fim de semana ou já passou das 18h, pula para o início do dia seguinte
    if (day === 0 || day === 6 || hour >= END_HOUR) {
        zoned = startOfDay(addDays(zoned, 1));
        zoned = setHours(zoned, START_HOUR);
        zoned = setMinutes(zoned, 0);
        zoned = setSeconds(zoned, 0);
    }
    // Se é dia de semana mas antes das 08h, ajusta para as 08h de hoje
    else if (hour < START_HOUR) {
        zoned = setHours(zoned, START_HOUR);
        zoned = setMinutes(zoned, 0);
        zoned = setSeconds(zoned, 0);
    }
    // Segurança: se já é hora útil, apenas avança 1 min para evitar loops
    else {
        zoned = addMinutes(zoned, 1);
    }

    const nextDate = fromZonedTime(zoned, TIMEZONE);

    // Se o próximo ponto ainda não for hora útil (ex: pulou de sexta para sábado), 
    // chama novamente até achar a segunda-feira 08h.
    if (!isBusinessHour(nextDate)) {
        return moveToNextBusinessStart(nextDate);
    }

    return nextDate;
}

export function addBusinessMinutes(startDate: Date, minutesToAdd: number): Date {
    let currentDate = startDate;
    let remainingMinutes = minutesToAdd;

    while (remainingMinutes > 0) {
        if (!isBusinessHour(currentDate)) {
            currentDate = moveToNextBusinessStart(currentDate);
        }

        const zoned = toZonedTime(currentDate, TIMEZONE);
        const endOfCurrentBusinessDay = fromZonedTime(
            setSeconds(setMinutes(setHours(zoned, END_HOUR), 0), 0),
            TIMEZONE
        );

        const availableMinutesToday = differenceInMinutes(endOfCurrentBusinessDay, currentDate);

        if (remainingMinutes <= availableMinutesToday) {
            currentDate = addMinutes(currentDate, remainingMinutes);
            remainingMinutes = 0;
        } else {
            remainingMinutes -= availableMinutesToday;
            currentDate = moveToNextBusinessStart(currentDate);
        }
    }

    return currentDate;
}

export function differenceInBusinessMinutes(laterDate: Date, earlierDate: Date): number {
    if (isBefore(laterDate, earlierDate)) return 0;

    let current = earlierDate;
    const end = laterDate;
    let totalMinutes = 0;

    while (isBefore(current, end)) {
        if (isBusinessHour(current)) {
            const zoned = toZonedTime(current, TIMEZONE);
            const endOfCurrentBusinessDay = fromZonedTime(
                setSeconds(setMinutes(setHours(zoned, END_HOUR), 0), 0),
                TIMEZONE
            );

            const nextReference = isBefore(endOfCurrentBusinessDay, end) ? endOfCurrentBusinessDay : end;

            totalMinutes += differenceInMinutes(nextReference, current);
            current = nextReference;
        } else {
            current = moveToNextBusinessStart(current);
        }
    }

    return totalMinutes;
}
