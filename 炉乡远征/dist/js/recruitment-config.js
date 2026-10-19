import { ALL_RECRUITMENT_IDS } from './recruitment-catalog.js';
// Initial project economy configuration, not original-game reward data.
export const RECRUITMENT_CONFIG = Object.freeze({schemaVersion:3,victoryTickets:1,adTickets:1,adEnabled:true,
 recipes:ALL_RECRUITMENT_IDS.map(cardId=>({cardId,fragmentsRequired:30})),
 pools:[{id:'premium',name:'随机招募',ticketCost:1,entries:ALL_RECRUITMENT_IDS.map(cardId=>({cardId,weight:1,fragments:1}))}],
 random:{coinsPerDraw:20,rewards:[{kind:'fragments',amount:1,weight:8800},{kind:'fragments',amount:2,weight:1100},{kind:'fragments',amount:5,weight:100}]}
});
