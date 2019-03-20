from snovault import (
    collection,
    calculated_property,
    load_schema,
)
from .base import (
    Item,
    paths_filtered_by_status,
)


@collection(
    name='analyses',
    unique_key='accession',
    properties={
        'title': 'Analyses',
        'description': 'Collection of analyses',
    })
class Analysis(Item):
    item_type = 'analysis'
    schema = load_schema('encoded:schemas/analysis.json')
    embedded = [
        'analysis_step_runs',
        'analysis_template',
        'analysis_template.analysis_steps',
        'dataset',
        'output_files',
    ]
    audit_inherit = [
        'analysis_step_runs',
    ]
    name_key = 'accession'
    set_status_up = [
        'analysis_step_runs',
        'files',
    ]
    set_status_down = [
        'analysis_step_runs',
        'files',
    ]
    _duplicated_step_runs = []
    _miss_steps = []
    _unexpected_step_runs = []

    @calculated_property(define=True, schema={
        "title": "Analysis step run(s)",
        "description": "Analysis step run(s) belonging to this analysis.",
        "type": "array",
        "items": {
            "title": "Analysis step run",
            "description": "One analysis step run of the analysis.",
            "comment": "See analysis_step_run.json for available identifiers.",
            "type": "string",
            "linkTo": "AnalysisStepRun"
        },
        "notSubmittable": True,
    })
    def analysis_step_runs(self, request, analysis_template, dataset):
        template_obj = request.embed(
            analysis_template,
            '@@object?skip_calculated=true'
        )
        assembly = template_obj['assembly']
        expected_step_ids = template_obj['analysis_steps']
        filtered_step_runs = {}
        dataset_obj = request.embed(dataset, '@@object')
        for step_run in dataset_obj.get('analysis_step_runs', []):
            step_run_obj = request.embed(
                step_run,
                '@@object'
            )
            if step_run_obj['assembly'] != assembly:
                continue
            step_id = request.embed(
                step_run_obj['analysis_step_version'],
                '@@object?skip_calculated=true'
            )['analysis_step']
            input_file_ids = tuple(sorted(step_run_obj.get('input_files', [])))
            if (step_id, input_file_ids) in filtered_step_runs:
                # Found duplicated analysis_step_runs
                filtered_step_runs[(step_id, input_file_ids)].append(step_run_obj['@id'])
            else:
                filtered_step_runs[(step_id, input_file_ids)] = [step_run_obj['@id']]
        analysis_step_runs = []
        for step_id, input_file_ids in filtered_step_runs:
            step_run_ids = filtered_step_runs[(step_id, input_file_ids)]
            if step_id not in expected_step_ids:
                self._unexpected_step_runs.append(step_run_ids)
                continue
            expected_step_ids.remove(step_id)
            analysis_step_runs.extend(step_run_ids)
            if len(step_run_ids) > 1:
                self._duplicated_step_runs.append(step_run_ids)
        self._miss_steps = expected_step_ids
        return analysis_step_runs

    @calculated_property(condition='analysis_step_runs', schema={
        "title": "Missing analysis steps",
        "description": "Analysis steps expected from analysis template but corresponding analysis step runs are either not present or short in number in the dataset.",
        "type": "array",
        "items": {
            "type": "string",
            "linkTo": "AnalysisStep",
        },
        "notSubmittable": True,
    })
    def miss_steps(self, request, analysis_step_runs):
        return self._miss_steps

    @calculated_property(condition='analysis_step_runs', schema={
        "title": "Duplicated sets of analysis step runs",
        "description": "Analysis step runs which are potentially duplicated in terms of inputs and analysis step.",
        "type": "array",
        "items": {
            "title": "A set of duplicated analysis step runs",
            "type": "array",
            "items": {
                "type": "string",
                "linkTo": "AnalysisStepRun",
            }
        },
        "notSubmittable": True,
    })
    def duplicated_step_runs(self, request, analysis_step_runs):
        return self._duplicated_step_runs

    @calculated_property(condition='analysis_step_runs', schema={
        "title": "Unexpected analysis step runs",
        "description": "Analysis step runs which are unexpected in analysis template.",
        "type": "array",
        "items": {
            "title": "A set of unexpected analysis step runs",
            "type": "array",
            "items": {
                "type": "string",
                "linkTo": "AnalysisStepRun",
            }
        },
        "notSubmittable": True,
    })
    def unexpected_step_runs(self, request, analysis_step_runs):
        return self._unexpected_step_runs

    @calculated_property(condition='analysis_step_runs', schema={
        "title": "Output files",
        "type": "array",
        "items": {
            "type": "string",
            "linkTo": "File",
        },
        "notSubmittable": True,
    })
    def output_files(self, request, analysis_step_runs):
        output_files = set()
        for step_run in analysis_step_runs:
            step_run_obj = request.embed(step_run, '@@object?skip_calculated=true')
            if 'output_files' in step_run_obj:
                output_files |= set(step_run_obj['output_files'])
        return paths_filtered_by_status(request, output_files)

    @calculated_property(condition='analysis_step_runs', schema={
        "title": "Input files analyzed",
        "type": "array",
        "items": {
            "type": "string",
            "linkTo": "File",
        },
        "notSubmittable": True,
    })
    def input_files_analyzed(self, request, analysis_step_runs):
        input_files = set()
        output_files = set()
        for step_run in analysis_step_runs:
            step_run_obj = request.embed(step_run, '@@object?skip_calculated=true')
            if 'output_files' in step_run_obj:
                output_files |= set(step_run_obj['output_files'])
            if 'input_files' in step_run_obj:
                input_files |= set(step_run_obj['input_files'])
        return paths_filtered_by_status(request, input_files - output_files)


@collection(
    name='analysis-templates',
    properties={
        'title': 'Analysis templates',
        'description': 'Collection of analysis templates',
    })
class AnalysisTemplate(Item):
    item_type = 'analysis_template'
    schema = load_schema('encoded:schemas/analysis_template.json')
