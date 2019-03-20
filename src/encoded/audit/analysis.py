from snovault import (
    AuditFailure,
    audit_checker,
)


@audit_checker('AnalysisTemplate', frame=[])
def audit_pipelines(value, system):
    expected_pipeline = value.get('pipeline')
    if not expected_pipeline:
        return
    actual_pipelines = set()
    for analysis_step in value['analysis_steps']:
        as_obj = system['request'].embed(analysis_step, '@@object')
        actual_pipelines |= set(as_obj['pipelines'])
    if {expected_pipeline} != actual_pipelines:
        detail = 'AnalysisTemplate suppose to use {} but actually used {}'.format(
            str(expected_pipeline),
            str(actual_pipelines)
        )
        yield AuditFailure(
            'mismatch pipeline',
            detail,
            level='INTERNAL_ACTION'
        )


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


def audit_input_files(value, system):
    expected_input = set(value.get('input_files_to_analyze', []))
    actual_input = set(value.get('input_files_analyzed', []))
    if actual_input - expected_input:
        detail = (
            'Input files {} are not supposed to be analyzed in analysis {}'
            ' but were actually analyzed.'
        ).format(
            str(actual_input - expected_input),
            value['accession']
        )
        yield AuditFailure(
            'unexpected input files',
            detail,
            level='INTERNAL_ACTION'
        )
    if expected_input - actual_input:
        detail = (
            'Input files {} should be analyzed in analysis {}'
            ' but were not analyzed.'
        ).format(
            str(expected_input - actual_input),
            value['accession']
        )
        yield AuditFailure(
            'unused input files',
            detail,
            level='INTERNAL_ACTION'
        )


function_dispatcher = {
    'audit_completeness': audit_completeness,
    'audit_input_files': audit_input_files,
}


@audit_checker('Analysis', frame=[])
def audit_file(value, system):
    for function_name in function_dispatcher.keys():
        for failure in function_dispatcher[function_name](value, system):
            yield failure
