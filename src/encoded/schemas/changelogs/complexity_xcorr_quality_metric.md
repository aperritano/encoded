## Changelog for complexity_xcorr_quality_metric.json

### Schema version 8

* *assay_term_name* enum *single-nuclei ATAC-seq* was changed to *single-nucleus ATAC-seq*

### Minor changes since schema version 7

* *size* in *cross_correlation_plot* was set to have a minimum of 0.
* *cross_correlation_plot* mime types enums list was extended to allow attachement of PNG images

### Schema version 7

* *status* property was restricted to one of  
    "enum" : [
        "in progress",
        "deleted",
        "released"
    ]

### Schema version 6

* *aliases* now must be properly namespaced according lab.name:alphanumeric characters with no leading or trailing spaces
* unsafe characters such as " # @ % ^ & | ~ ; ` [ ] { } and consecutive whitespaces will no longer be allowed in the alias

### Schema version 5

* *assay_term_id* is no longer allowed to be submitted, it will be automatically calculated based on the *term_name*
* *notes* field is no longer allowed to have leading or trailing whitespace or contain just an empty string.
