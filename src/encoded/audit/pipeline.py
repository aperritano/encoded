from snovault import (
    AuditFailure,
    audit_checker,
)


@audit_checker('Pipeline', frame=['analysis_steps'])
def audit_analysis_steps_closure(value, system):
    ''' The analysis_steps list should include all of a steps ancestors.
    '''
    if 'analysis_steps' not in value:
        return
    ids = {step['@id'] for step in value['analysis_steps']}
    parents = {parent for step in value['analysis_steps'] for parent in step.get('parents', [])}
    diff = parents.difference(ids)
    if diff:
        detail = ', '.join(sorted(diff))
        raise AuditFailure('incomplete analysis_steps', detail, level='ERROR')


@audit_checker(
    'AnalysisStepRun',
    frame=[
        'analysis_step_version.analysis_step',
        'input_files',
        'output_files',
        'previous_step_runs.analysis_step_version',
    ]
)
def audit_analysis_steps_run(value, system):
    if 'previous_step_runs' in value:
        previous_step_run_steps = set(
            analysis_step_run['analysis_step_version']['analysis_step']
            for analysis_step_run in value['previous_step_runs']
        )
    else:
        previous_step_run_steps = set()
    expected_steps = set(
        value['analysis_step_version']['analysis_step'].get('parents', [])
    )
    if previous_step_run_steps - expected_steps:
        detail = 'Unexpected parental analysis step: {}'
        yield AuditFailure(
            'unexpected parental analysis_steps',
            detail.format(','.join(previous_step_run_steps - expected_steps)),
            level='INTERNAL_ACTION'
        )
    if expected_steps - previous_step_run_steps:
        detail = 'Miss parental analysis step: {}'
        yield AuditFailure(
            'miss parental analysis_steps',
            detail.format(','.join(expected_steps - previous_step_run_steps)),
            level='INTERNAL_ACTION'
        )
    observed_input_type = set(f['output_type'] for f in value.get('input_files', []))
    expected_input_type = set(value.get('input_file_types', []))
    if observed_input_type ^ expected_input_type:
        detail = (
            'Expected input file types are {}, '
            'while actual input file types are {}'
        )
        yield AuditFailure(
            'wrong input type',
            detail.format(','.join(expected_input_type), ','.join(observed_input_type)),
            level='INTERNAL_ACTION'
        )
    observed_output_type = set(f['output_type'] for f in value.get('input_files', []))
    expected_output_type = set(value.get('output_file_types', []))
    if observed_output_type ^ expected_output_type:
        detail = (
            'Expected output file types are {}, '
            'while actual output file types are {}'
        )
        yield AuditFailure(
            'wrong output type',
            detail.format(','.join(expected_output_type), ','.join(observed_output_type)),
            level='INTERNAL_ACTION'
        )


# def audit_pipeline_assay(value, system):
# https://encodedcc.atlassian.net/browse/ENCD-3416
