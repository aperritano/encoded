## Changelog for reference.json

### Minor changes since schema version 16

* *functional elements* is added to the enums list of *reference_type* property
* Added *MouseDevSeries* enum to *internal_tags*
* *reference_type* was updated to include the enum *sequence adapters*

### Schema version 16

* *internal_tags* removes cre_inputv10 and cre_inputv11, and adds ENCYCLOPEDIAv5, ccre_inputv1, and ccre_inputv2.

### Schema version 15

* Replace *started* enum in *status* with *in progress*.

### Schema version 14

* Replace the *status* field value *ready for review* by *submitted*. Make the *status* field editable by DCC personnel only.

### Schema version 13

* Remove *proposed* from *status* enum (*dataset* mixin).

### Schema version 12

* *alternate_accessions* now must match accession format, "ENCSR..." or "TSTSR..."
