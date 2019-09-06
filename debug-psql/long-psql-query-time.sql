\o exp-av-pg93.json

EXPLAIN (analyze, verbose, format json)

SELECT 
    keys.name AS keys_name, 
    keys.value AS keys_value, 
    keys.rid AS keys_rid, 
    
    propsheets_1.sid AS propsheets_1_sid, 
    propsheets_1.rid AS propsheets_1_rid, 
    propsheets_1.name AS propsheets_1_name, 
    propsheets_1.properties AS propsheets_1_properties, 
    propsheets_1.tid AS propsheets_1_tid, 
    
    current_propsheets_1.rid AS current_propsheets_1_rid, 
    current_propsheets_1.name AS current_propsheets_1_name, 
    current_propsheets_1.sid AS current_propsheets_1_sid, 
    resources_1.rid AS resources_1_rid, 
    resources_1.item_type AS resources_1_item_type 

FROM keys 
    JOIN resources AS resources_1 ON resources_1.rid = keys.rid 
    
    JOIN current_propsheets AS current_propsheets_1 ON resources_1.rid = current_propsheets_1.rid 
    
    JOIN propsheets AS propsheets_1 ON current_propsheets_1.sid = propsheets_1.sid 

WHERE keys.name = 'lab:name' AND keys.value = 'peggy-farnham' limit 1;

\q
