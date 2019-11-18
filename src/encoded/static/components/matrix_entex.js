import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import * as encoding from '../libs/query_encoding';
import QueryString from '../libs/query_string';
import { svgIcon } from '../libs/svg-icons';
import { Panel, PanelBody } from '../libs/ui/panel';
import DataTable from './datatable';
import * as globals from './globals';
import { SearchFilter } from './matrix';
import { MatrixInternalTags } from './objectutils';
import { SearchControls } from './search';


/**
 * Maximum number of selected items that can be visualized.
 * @constant
 */
const VISUALIZE_LIMIT = 500;


/**
 * Order in which assay_titles should appear along the horizontal axis of the matrix. Anything not
 * included gets sorted after these.
 */
const assaySortOrder = [
    'polyA plus RNA-seq',
    'total RNA-seq',
    'small RNA-seq',
    'microRNA-seq',
    'microRNA counts',
    'RNA microarray',
    'DNase-seq',
    'ATAC-seq',
    'WGBS',
    'RRBS',
    'MeDIP-seq',
    'MRE-seq',
    'TF ChIP-seq',
    'Histone ChIP-seq',
];

/**
 * All assay columns to not include in matrix.
 */
const excludedAssays = [
    'Control ChIP-seq',
    'Control eCLIP',
];

/**
 * All assays that have targets but we don't display the target columns, and instead show that data
 * combined in the assay column.
 */
const collapsedAssays = [
    'MeDIP-seq',
];


/**
 * Draw a legend of what the quadrants in each matrix cell means.
 */
const DonorLegend = () => (
    <div className="donor-legend">
        <div className="donor-legend__row">
            <div className="donor-legend__female-label">&#x2640; 1</div>
            <div className="donor-quadrant donor-quadrant--female1" />
            <div className="donor-quadrant donor-quadrant--male1" />
            <div className="donor-legend__male-label">1 &#x2642;</div>
        </div>
        <div className="donor-legend__row">
            <div className="donor-legend__female-label">&#x2640; 2</div>
            <div className="donor-quadrant donor-quadrant--female2" />
            <div className="donor-quadrant donor-quadrant--male2" />
            <div className="donor-legend__male-label">2 &#x2642;</div>
        </div>
    </div>
);


/**
 * Generate an assay:column map that maps from a combined assay and target name to a column index
 * in the matrix. Any determination of column order or inclusion/exclusion happens in this
 * function. Do not rely on the order of the keys. The resulting object has the form:
 * {
 *   'cat1': {col: 0, category: 'cat1', hasSubcategories: true},
 *   'cat1|subcat1': {col: 1, category: 'cat1', subcategory: 'subcat1'},
 *   'cat1|subcat2': {col: 2, category: 'cat1', subcategory: 'subcat2'},
 *   'cat3': {col: 5, category: 'cat3', hasSubcategories: false},
 *   'cat2': {col: 3, category: 'cat2', hasSubcategories: true},
 *   'cat2|subcat3': {col: 4, category: 'cat2', subcategory: 'subcat3'},
 *   ...
 * }
 * @param {object} context Reference epigenome matrix data
 *
 * @return {object} Keyed column header information
 */
const generateColMap = (context) => {
    const colCategory = context.matrix.x.group_by[0];
    const colSubcategory = context.matrix.x.group_by[1][0];
    const colMap = {};
    let colIndex = 0;

    // Sort column categories according to a specified order, with any items not specified sorted
    // at the end in order of occurrence.
    const colCategoryBuckets = context.matrix.x[colCategory].buckets;
    const sortedColCategoryBuckets = _(colCategoryBuckets).sortBy((colCategoryBucket) => {
        const sortIndex = assaySortOrder.indexOf(colCategoryBucket.key);
        return sortIndex >= 0 ? sortIndex : colCategoryBuckets.length;
    });

    // Generate the column map based on the sorted category buckets.
    sortedColCategoryBuckets.forEach((colCategoryBucket) => {
        if (!excludedAssays.includes(colCategoryBucket.key)) {
            const colSubcategoryBuckets = colCategoryBucket[colSubcategory].buckets;

            // Add the mapping of "<assay>" key string to column index.
            colMap[colCategoryBucket.key] = { col: colIndex, category: colCategoryBucket.key, hasSubcategories: colSubcategoryBuckets.length > 0 && colSubcategoryBuckets[0].key !== 'no_target' };
            colIndex += 1;

            // Add the mapping of "<assay>|<target>"" key string to column index for those assays that
            // have targets and don't collapse their targets. A target of "no_target" means the
            // assay has no targets so no targets need to appear in the column map for that assay.
            if (!collapsedAssays.includes(colCategoryBucket.key)) {
                colSubcategoryBuckets.forEach((colSubcategoryBucket) => {
                    if (colSubcategoryBucket.key !== 'no_target') {
                        colMap[`${colCategoryBucket.key}|${colSubcategoryBucket.key}`] = {
                            col: colIndex,
                            category: colCategoryBucket.key,
                            subcategory: colSubcategoryBucket.key,
                        };
                        colIndex += 1;
                    }
                });
            }
        }
    });
    return colMap;
};


/**
 * Display a disabled cell in the matrix. Used to reduce a bit of code per cell when matrices can
 * be very large.
 */
const DisabledCell = () => <div className="matrix__disabled-cell" />;


/**
 * CSS-class suffixes for each quadrant of a cell.
 */
const donorQuadrantCss = ['female1', 'male1', 'female2', 'male2'];


/**
 * Verbal equivalents of quadrants for screen readers.
 */
const donorQuadrantVoice = ['Female 1', 'Male 1', 'Female 2', 'Male 2'];


/**
 * Render a single cell within the table that contains up to four donors, with each quadrant of the
 * cell devoted to a consistent donor throughout the table.
 */
const DonorCell = ({ donorQuadrants, donorDatum, rowCategory, rowSubcategory, colCategory, colSubcategory }) => {
    const donorSummary = donorDatum.map(donorAccession => donorQuadrantVoice[donorQuadrants.indexOf(donorAccession)]).join(', ');
    return (
        <div className="donor-cell">
            {donorQuadrants.map((quadrant, quadrantIndex) => {
                const quadrantStyle = `donor-quadrant donor-quadrant--${donorDatum.includes(quadrant) ? donorQuadrantCss[quadrantIndex] : 'none'}`;
                return <div key={quadrant} className={quadrantStyle} />;
            })}
            <div className="sr-only">{donorDatum.length} {donorDatum.length > 1 ? 'donors' : 'donor'}, {donorSummary}.</div>
            <div className="sr-only">Search {rowCategory}, {rowSubcategory} for {colCategory}, {colSubcategory === 'no_target' ? '' : colSubcategory}</div>
        </div>
    );
};

DonorCell.propTypes = {
    /** All four possible donor accessions in quadrant order [TL, TR, BL, BR] */
    donorQuadrants: PropTypes.array.isRequired,
    /** Donor accessions in cell in no defined order */
    donorDatum: PropTypes.array.isRequired,
    /** Row category text for screen readers */
    rowCategory: PropTypes.string.isRequired,
    /** Row subcategory text for screen readers */
    rowSubcategory: PropTypes.string.isRequired,
    /** Column category text for screen readers */
    colCategory: PropTypes.string.isRequired,
    /** Column subcategory text for screen readers */
    colSubcategory: PropTypes.string.isRequired,
};


/**
 * Determine the accessions of the four quadrants of each cell. The quadrants in order are:
 * TL - first female accession
 * TR - first male accession
 * BL - second female accession
 * BR - second male accession
 * @param {object} context Search results object for ENTEx matrix.
 *
 * @return {array} Accessions of four donors in [TL, TR, BL, BR] order; null if invalid data
 */
const getDonorQuadrants = (context) => {
    const colCategory = context.matrix.x.group_by[0];
    const colSubcategory = context.matrix.x.group_by[1][0];
    const cellCategory = context.matrix.x.group_by[2];
    const cellSubcategory = context.matrix.x.group_by[3];
    const accessions = { female: [], male: [] };

    // Using nested .some() iterators to allow short-circuiting loops so we don't continue to
    // iterate through the matrix data once we have found all four donors, while not running afoul
    // of strict ESLint/AirBnB loop short-circuiting restrictions.
    context.matrix.x[colCategory].buckets.some(colCategoryBucket => (
        // assay_title.buckets
        colCategoryBucket[colSubcategory].buckets.some(colSubcategoryBuckets => (
            // target.label.buckets
            colSubcategoryBuckets[cellCategory].buckets.some((cellCategoryBuckets) => {
                // At the "sex" level of matrix.y data. Only continue if we haven't yet seen two
                // accessions for the current sex.
                let anyCellCategory = false;
                const sex = cellCategoryBuckets.key;
                if (accessions[sex].length < 2) {
                    anyCellCategory = cellCategoryBuckets[cellSubcategory].buckets.some((cellSubcategoryBuckets) => {
                        // Now at the donor-accession level of the matrix.y data. If we haven't yet
                        // seen this accession, add it to the appropriate array of accessions for
                        // the current sex.
                        const accession = cellSubcategoryBuckets.key;
                        if (!accessions[sex].includes(accession)) {
                            accessions[sex].push(accession);

                            // If we now have two female and two male accessions, return "true"
                            // which cascades through all the nested loops.
                            return (accessions.female.length === 2 && accessions.male.length === 2);
                        }
                        return false;
                    });
                }
                return anyCellCategory;
            })
        ))
    ));

    // Need all four donors for this matrix to be renderable and meaningful.
    if (accessions.female.length === 2 && accessions.male.length === 2) {
        return [accessions.female[0], accessions.male[0], accessions.female[1], accessions.male[1]];
    }
    return null;
};


/**
 * Takes matrix data from JSON and generates an object that <DataTable> can use to generate the JSX
 * for the matrix. This is a shim between the incoming matrix data and the object <DataTable>
 * needs.
 * @param {object} context Matrix JSON for the page
 *
 * @return {object} Generated object suitable for passing to <DataTable>
 */

const convertContextToDataTable = (context) => {
    const colCategory = context.matrix.x.group_by[0];
    const colSubcategory = context.matrix.x.group_by[1][0];
    const cellCategory = context.matrix.x.group_by[2];
    const cellSubcategory = context.matrix.x.group_by[3];
    const rowCategory = context.matrix.y.group_by[0];
    const rowSubcategory = context.matrix.y.group_by[1];

    // Generate the mapping of column categories and subcategories.
    const colMap = generateColMap(context);
    const colCount = Object.keys(colMap).length;

    // Convert column map to an array of column map values sorted by column number for displaying
    // in the matrix header.
    const sortedCols = Object.keys(colMap).map(assayColKey => colMap[assayColKey]).sort((colInfoA, colInfoB) => colInfoA.col - colInfoB.col);

    // Generate array of names of assays that have targets and don't collapse their targets, for
    // rendering those columns as disabled.
    const colCategoriesWithSubcategories = Object.keys(colMap).filter(colCategoryName => colMap[colCategoryName].hasSubcategories && !collapsedAssays.includes(colCategoryName));

    // Generate the hierarchical top-row sideways header label cells. The first cell has the
    // legend for the cell data. At the end of this loop, rendering `{header}` shows this header
    // row. The `sortedCols` array gets mutated in this loop, acquiring a `query` property in each
    // of its objects that gets used later to generate cell hrefs.
    const header = [
        { content: <DonorLegend />, css: 'matrix__entex-corner' },
    ].concat(sortedCols.map((colInfo) => {
        const categoryQuery = `${colCategory}=${encoding.encodedURIComponent(colInfo.category)}`;
        if (!colInfo.subcategory) {
            // Add the category column links.
            colInfo.query = categoryQuery;
            return { header: <a href={`${context.search_base}&${categoryQuery}`}>{colInfo.category} <div className="sr-only">{context.matrix.x.label}</div></a> };
        }

        // Add the subcategory column links.
        const subCategoryQuery = `${colSubcategory}=${encoding.encodedURIComponent(colInfo.subcategory)}`;
        colInfo.query = `${categoryQuery}&${subCategoryQuery}`;
        return { header: <a className="sub" href={`${context.search_base}&${categoryQuery}&${subCategoryQuery}`}>{colInfo.subcategory} <div className="sr-only">target for {colInfo.category} {context.matrix.x.label} </div></a> };
    }));

    // Generate the main table content including the data hierarchy, where the upper level of the
    // hierarchy gets referred to here as "rowCategory" and the lower-level gets referred to as
    // "rowSubcategory." Both these types of rows get collected into `dataTable` which gets passed
    // to <DataTable>. Also generate an array of React keys to use with <DataMatrix> by using an
    // array index that's independent of the reduce-loop index because of spacer/expander row
    // insertion.
    let matrixRow = 1;
    const rowKeys = ['column-categories'];
    const rowCategoryBuckets = context.matrix.y[rowCategory].buckets;

    const donorQuadrants = getDonorQuadrants(context);
    const dataTable = rowCategoryBuckets.reduce((accumulatingTable, rowCategoryBucket) => {
        // Each loop iteration generates one biosample classification row as well as the rows of
        // biosample term names under it.
        const rowSubcategoryBuckets = rowCategoryBucket[rowSubcategory].buckets;
        const rowCategoryQuery = `${rowCategory}=${encoding.encodedURIComponent(rowCategoryBucket.key)}`;

        // Update the row key mechanism.
        rowKeys[matrixRow] = rowCategoryBucket.key;
        matrixRow += 1;

        // Generate one classification's rows of term names.
        const cells = Array(colCount);
        const subcategoryRows = rowSubcategoryBuckets.map((rowSubcategoryBucket) => {
            const subCategoryQuery = `${rowSubcategory}=${encoding.encodedURIComponent(rowSubcategoryBucket.key)}`;

            cells.fill(null);
            rowSubcategoryBucket[colCategory].buckets.forEach((rowSubcategoryColCategoryBucket) => {
                // Skip any excluded assay columns.
                if (!excludedAssays.includes(rowSubcategoryColCategoryBucket.key)) {
                    rowSubcategoryColCategoryBucket[colSubcategory].buckets.forEach((rowSubcategoryColSubcategoryBucket) => {
                        const donorData = [];
                        rowSubcategoryColSubcategoryBucket[cellCategory].buckets.forEach((cellCategoryBucket) => {
                            cellCategoryBucket[cellSubcategory].buckets.forEach((cellSubcategoryBucket) => {
                                donorData.push(cellSubcategoryBucket.key);
                            });
                        });

                        if (rowSubcategoryColSubcategoryBucket.key === 'no_target' || collapsedAssays.includes(rowSubcategoryColCategoryBucket.key)) {
                            // The assay does not have targets, or it does but collapses them, so just
                            // add a colored cell for the column category.
                            const colIndex = colMap[rowSubcategoryColCategoryBucket.key].col;
                            cells[colIndex] = {
                                content: (
                                    <a href={`${context.search_base}&${rowCategoryQuery}&${subCategoryQuery}&${colMap[rowSubcategoryColCategoryBucket.key].query}`}>
                                        <DonorCell
                                            donorQuadrants={donorQuadrants}
                                            donorDatum={donorData}
                                            rowCategory={rowCategoryBucket.key}
                                            rowSubcategory={rowSubcategoryBucket.key}
                                            colCategory={rowSubcategoryColCategoryBucket.key}
                                            colSubcategory={rowSubcategoryColSubcategoryBucket.key}
                                        />
                                    </a>
                                ),
                            };
                        } else {
                            const colMapKey = `${rowSubcategoryColCategoryBucket.key}|${rowSubcategoryColSubcategoryBucket.key}`;
                            const colIndex = colMap[colMapKey].col;
                            cells[colIndex] = {
                                content: (
                                    <a href={`${context.search_base}&${rowCategoryQuery}&${subCategoryQuery}&${colMap[colMapKey].query}`}>
                                        <DonorCell
                                            donorQuadrants={donorQuadrants}
                                            donorDatum={donorData}
                                            rowCategory={rowCategoryBucket.key}
                                            rowSubcategory={rowSubcategoryBucket.key}
                                            colCategory={rowSubcategoryColCategoryBucket.key}
                                            colSubcategory={rowSubcategoryColSubcategoryBucket.key}
                                        />
                                    </a>
                                ),
                            };
                        }
                    });
                }
            });

            // Show assay columns as disabled (i.e. nothing to see here) if those columns have
            // target columns.
            colCategoriesWithSubcategories.forEach((colCategoryName) => {
                cells[colMap[colCategoryName].col] = { content: <DisabledCell /> };
            });

            // Add a single term-name row's data and left header to the matrix. The first data row
            // is `matrixRow` 3 -- 1 is the header row, first data row is 2, and then an increment
            // before the return.
            rowKeys[matrixRow] = `${rowCategoryBucket.key}|${rowSubcategoryBucket.key}`;
            matrixRow += 1;
            return {
                rowContent: [
                    {
                        header: (
                            <a href={`${context.search_base}&${rowCategoryQuery}&${subCategoryQuery}`}>
                                <div className="subcategory-row-text">{rowSubcategoryBucket.key} <div className="sr-only">{context.matrix.y.label}</div></div>
                            </a>
                        ),
                    },
                ].concat(cells),
                css: `matrix__row-data${matrixRow === 3 ? ' matrix__row-data--first' : ''}`,
            };
        });

        // Generate a row for a classification concatenated with the term-name rows under it,
        // concatenated with an spacer row that might be empty or might have a rowCategory expander
        // button.
        return accumulatingTable.concat(subcategoryRows);
    }, [{ rowContent: header, css: 'matrix__col-category-header' }]);
    return { dataTable, rowKeys };
};


/**
 * Render the area above the matrix itself, including the page title.
 */
const MatrixHeader = ({ context }) => {
    const visualizeDisabledTitle = context.total > VISUALIZE_LIMIT ? `Filter to ${VISUALIZE_LIMIT} to visualize` : '';

    return (
        <div className="matrix-header">
            <div className="matrix-header__title">
                <h1>{context.title}</h1>
                <div className="matrix-tags">
                    <MatrixInternalTags context={context} />
                </div>
            </div>
            <div className="matrix-header__controls">
                <div className="matrix-header__filter-controls">
                    <SearchFilter context={context} />
                </div>
                <div className="matrix-header__search-controls">
                    <h4>Showing {context.total} results</h4>
                    <SearchControls context={context} visualizeDisabledTitle={visualizeDisabledTitle} hideBrowserSelector />
                </div>
            </div>
        </div>
    );
};

MatrixHeader.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


/**
 * Display the matrix and associated controls above them.
 */
const MatrixPresentation = ({ context }) => {
    const [scrolledRight, setScrolledRight] = React.useState(false);

    // Callback gets called when the user scrolls the matrix div horizontally. This lets us update
    // `scrolledRight` so we know whether to flash the scroll-indicator arrow or not.
    const scrollableRef = React.useCallback((node) => {
        if (node) {
            // Have to use a "roughly equal to" test because of an MS Edge bug mentioned here:
            // https://stackoverflow.com/questions/30900154/workaround-for-issue-with-ie-scrollwidth
            const scrollDiff = Math.abs((node.target.scrollWidth - node.target.scrollLeft) - node.target.clientWidth);
            if (scrollDiff < 2 && !scrolledRight) {
                // Right edge of matrix scrolled into view.
                setScrolledRight(true);
            } else if (scrollDiff >= 2 && scrolledRight) {
                // Right edge of matrix scrolled out of view.
                setScrolledRight(false);
            }
            // Else nothing needs to change.
        } else if (!scrolledRight) {
            // Don't flash the scroll indicator if nothing to scroll.
            setScrolledRight(true);
        }
    }, [scrolledRight]);

    // Convert ENTEx matrix data to a DataTable object.
    const { dataTable, rowKeys } = convertContextToDataTable(context);
    const matrixConfig = {
        rows: dataTable,
        rowKeys,
        tableCss: 'matrix',
    };

    return (
        <div className="matrix__presentation">
            <div className={`matrix__label matrix__label--horz${!scrolledRight ? ' horz-scroll' : ''}`}>
                <span>{context.matrix.x.label}</span>
                {svgIcon('largeArrow')}
            </div>
            <div className="matrix__presentation-content">
                <div className="matrix__label matrix__label--vert"><div>{svgIcon('largeArrow')}{context.matrix.y.label}</div></div>
                <div className="matrix__data" onScroll={scrollableRef}>
                    {matrixConfig ? <DataTable tableData={matrixConfig} /> : null}
                </div>
            </div>
        </div>
    );
};

MatrixPresentation.propTypes = {
    /** Reference epigenome matrix object */
    context: PropTypes.object.isRequired,
};

MatrixPresentation.contextTypes = {
    navigate: PropTypes.func,
};


/**
 * Render the area containing the matrix.
 */
const MatrixContent = ({ context }) => (
    <div className="matrix__content matrix__content--entex">
        <MatrixPresentation context={context} />
    </div>
);

MatrixContent.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


/**
 * View component for the ENTEx matrix page.
 */
const EntexMatrix = ({ context }) => {
    const itemClass = globals.itemClass(context, 'view-item');

    if (context.total > 0) {
        return (
            <Panel addClasses={itemClass}>
                <PanelBody>
                    <MatrixHeader context={context} />
                    <MatrixContent context={context} />
                </PanelBody>
            </Panel>
        );
    }
    return <h4>No results found</h4>;
};

EntexMatrix.propTypes = {
    context: PropTypes.object.isRequired,
};

EntexMatrix.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
    biosampleTypeColors: PropTypes.object, // DataColor instance for experiment project
};

globals.contentViews.register(EntexMatrix, 'EntexMatrix');
