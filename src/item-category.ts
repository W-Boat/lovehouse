import {places} from '../content/places';
import {seatDefinition} from './layouts';
import type {Item,Zone} from './world';
/** Display copy may change language; furniture identity does not. */
export function isSeatItem(zone:Zone,item:Item){return Boolean(seatDefinition(zone,item.id)?.hips||places[item.id]?.sit||['sofa','swing','bench','sea'].includes(item.id))}
