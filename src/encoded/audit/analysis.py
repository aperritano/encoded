from snovault import (
    AuditFailure,
    audit_checker,
)


@audit_checker('Analysis', frame=[])
def audit_completeness(value, system):
    if value.get('miss_steps'):
        detail = (
            "Miss analysis steps: {} according to analysis template {}."
        ).format(', '.join(value['miss_steps']), value['analysis_template'])
        yield AuditFailure(
            'miss analysis steps',
            detail,
            level='INTERNAL_ACTION'
        )
    for analysis_step_runs in value.get('duplicated_step_runs', []):
        detail = (
            "Potentially duplicated analysis step runs {} which have "
            "the same analysis step and input files."
        ).format(', '.join(analysis_step_runs))
        yield AuditFailure(
            'duplicated step runs',
            detail,
            level='INTERNAL_ACTION'
        )
